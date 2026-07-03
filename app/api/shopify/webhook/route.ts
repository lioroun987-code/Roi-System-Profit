import { NextRequest, after } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/shopify'
import { analyzeOrder } from '@/lib/claude'
import { calculateOrderCost } from '@/lib/calculator'
import { getGoogleAuthClient } from '@/lib/sheets'
import { google } from 'googleapis'
import { BusinessConfig, ShopifyOrder } from '@/types'

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

    let dbOrder
    try {
      dbOrder = await prisma.order.create({
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
    } catch (e) {
      // Shopify retries webhooks — a concurrent delivery may win the insert race.
      // Unique-constraint violation means the order is already handled: ack with 200.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return new Response('Already processed', { status: 200 })
      }
      throw e
    }

    // Run analysis + sheet update after the response is sent.
    // after() keeps the serverless function alive until the work finishes —
    // a bare fire-and-forget promise gets killed once the response returns.
    after(() => analyzeAndUpdateSheet(dbOrder.id, business.id, order))

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

    // 1. Try deterministic calculator first (free), fall back to AI for unknowns
    const analysis = calculateOrderCost(order, config) ?? await analyzeOrder(order, config)

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
        analysis.my_cost_ils
      )
    }
  } catch (error) {
    console.error('Analysis/sheet error:', error)
    await prisma.order.update({ where: { id: orderId }, data: { status: 'error' } })
  }
}

// Sheet layout: order number lives in column I, and we write the cost into
// column G. Orders are added to the sheet by an external Make automation and
// arrive with column G empty — we only fill that gap and never overwrite a
// row that already has a cost.
const SHEET_COL_ORDER = 8   // I — order number written by Make
const SHEET_COL_COST  = 6   // G — my cost (target)

async function updateSheetRow(
  refreshToken: string,
  spreadsheetId: string,
  orderNumber: string,
  myCostIls: number
) {
  try {
    const auth = getGoogleAuthClient(refreshToken)
    const sheets = google.sheets({ version: 'v4', auth })

    // Read A..I so column indices are absolute (A=0 … I=8), unbounded so orders
    // past row 1000 aren't silently missed.
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A2:I',
    })

    const rows = readRes.data.values ?? []
    const wanted = orderNumber.replace('#', '').trim()
    let targetRow = -1

    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i]?.[SHEET_COL_ORDER]?.toString().replace('#', '').trim()
      if (cell !== wanted) continue

      // Row matches — but only fill it when the cost cell (G) is still empty.
      const existingCost = rows[i]?.[SHEET_COL_COST]?.toString().trim()
      if (existingCost) {
        console.log(`Order ${orderNumber} already has a cost in the sheet — leaving it untouched`)
        return
      }
      targetRow = i + 2 // +2: data starts at row 2
      break
    }

    if (targetRow === -1) {
      console.log(`Order ${orderNumber} not found in sheet — skipping sheet update`)
      return
    }

    // Write the cost into column G only — nothing else on the row is touched.
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `G${targetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[myCostIls.toFixed(2)]] },
    })

    console.log(`Sheet updated: row ${targetRow}, order ${orderNumber}, cost ${myCostIls}`)
  } catch (error) {
    console.error('Sheet update error:', error)
  }
}
