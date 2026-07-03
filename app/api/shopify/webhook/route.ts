import { NextRequest, after } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/shopify'
import { analyzeOrder } from '@/lib/claude'
import { calculateOrderCost } from '@/lib/calculator'
import { upsertOrderRowInSheet } from '@/lib/sheets'
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

    // 3. Write the order into the Google Sheet if connected — appends a full
    //    row (or fills the cost of an existing one), replacing the Make automation.
    if (business.googleRefreshToken && business.googleSheetsId) {
      await upsertOrderRowInSheet(
        business.googleRefreshToken,
        business.googleSheetsId,
        {
          orderNumber:   String(order.order_number),
          customerName:  order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
            : null,
          orderDate:     new Date(order.created_at),
          storePriceIls: analysis.store_price_breakdown.total,
          myCostIls:     analysis.my_cost_ils,
        }
      )
    }
  } catch (error) {
    console.error('Analysis/sheet error:', error)
    await prisma.order.update({ where: { id: orderId }, data: { status: 'error' } })
  }
}
