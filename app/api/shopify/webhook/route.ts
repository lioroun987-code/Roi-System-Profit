import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/shopify'
import { analyzeOrder } from '@/lib/claude'
import { getGoogleAuthClient } from '@/lib/sheets'
import { google } from 'googleapis'
import { BusinessConfig, ShopifyOrder } from '@/types'

const COL_ORDER_NUMBER = 1  // A
const COL_MY_COST      = 7  // G
const COL_NET_PROFIT   = 8  // H

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmac = request.headers.get('x-shopify-hmac-sha256') ?? ''
  const domain = request.headers.get('x-shopify-shop-domain') ?? ''

  const business = await prisma.business.findFirst({
    where: { shopifyDomain: domain },
  })

  if (!business) return new Response('Business not found', { status: 404 })

  // Verify HMAC — use per-business secret if set, otherwise use app-level secret
  const secret = business.shopifyWebhookSecret || process.env.SHOPIFY_API_SECRET
  if (secret) {
    const valid = verifyWebhookSignature(rawBody, hmac, secret)
    if (!valid) return new Response('Invalid signature', { status: 401 })
  }

  let order: ShopifyOrder
  try {
    order = JSON.parse(rawBody) as ShopifyOrder
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  try {
    const existing = await prisma.order.findUnique({
      where: { businessId_shopifyOrderId: { businessId: business.id, shopifyOrderId: String(order.id) } },
    })
    if (existing) return new Response('Already processed', { status: 200 })

    const dbOrder = await prisma.order.create({
      data: {
        businessId: business.id,
        shopifyOrderId: String(order.id),
        orderNumber: String(order.order_number),
        orderDate: new Date(order.created_at),
        customerName: order.customer
          ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
          : null,
        customerEmail: order.customer?.email ?? null,
        rawData: order as any,
        status: 'pending',
      },
    })

    // Run analysis + sheet update in background
    analyzeAndUpdateSheet(dbOrder.id, business.id, order)

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal error', { status: 500 })
  }
}

async function analyzeAndUpdateSheet(orderId: string, businessId: string, order: ShopifyOrder) {
  try {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) return

    const config: BusinessConfig = {
      productCosts: business.productCosts as any,
      discountRules: business.discountRules as any,
      paymentSettings: business.paymentSettings as any,
      aiNotes: business.aiNotes ?? '',
    }

    // 1. Analyze with AI
    const analysis = await analyzeOrder(order, config)

    // 2. Save to DB
    await prisma.order.update({
      where: { id: orderId },
      data: {
        aiAnalysis: analysis as any,
        orderSummary: analysis.order_summary,
        storePrice: analysis.store_price_breakdown.total,
        myCostUsd: analysis.my_cost_breakdown.total_usd,
        myCostIls: analysis.my_cost_ils,
        grossProfitIls: analysis.gross_profit_ils,
        paymentFeeIls: analysis.payment_fee_ils,
        vatIls: analysis.vat_ils,
        netProfitIls: analysis.net_profit_ils,
        netProfitUsd: analysis.net_profit_usd,
        paymentMethod: analysis.payment_method,
        status: 'analyzed',
      },
    })

    // 3. Update Google Sheet if connected
    if (business.googleRefreshToken && business.googleSheetsId) {
      await updateSheetRow(
        business.googleRefreshToken,
        business.googleSheetsId,
        String(order.order_number),
        analysis.my_cost_ils,
        analysis.net_profit_ils
      )
    }
  } catch (error) {
    console.error('Analysis/sheet error:', error)
    await prisma.order.update({ where: { id: orderId }, data: { status: 'error' } })
  }
}

async function updateSheetRow(
  refreshToken: string,
  spreadsheetId: string,
  orderNumber: string,
  myCostIls: number,
  netProfitIls: number
) {
  try {
    const auth = getGoogleAuthClient(refreshToken)
    const sheets = google.sheets({ version: 'v4', auth })

    // Read column A to find the row with this order number
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A2:A1000',
    })

    const rows = readRes.data.values ?? []
    let targetRow = -1

    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i]?.[0]?.toString().replace('#', '').trim()
      if (cell === orderNumber.replace('#', '').trim()) {
        targetRow = i + 2 // +2 because we start from row 2
        break
      }
    }

    if (targetRow === -1) {
      console.log(`Order ${orderNumber} not found in sheet — skipping sheet update`)
      return
    }

    // Write cost and profit to columns G and H
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `G${targetRow}:H${targetRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          myCostIls.toFixed(2),
          netProfitIls.toFixed(2),
        ]],
      },
    })

    console.log(`Sheet updated: row ${targetRow}, order ${orderNumber}, cost ${myCostIls}, profit ${netProfitIls}`)
  } catch (error) {
    console.error('Sheet update error:', error)
  }
}
