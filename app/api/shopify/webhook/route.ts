import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/shopify'
import { analyzeOrder } from '@/lib/claude'
import { BusinessConfig, ShopifyOrder } from '@/types'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmac = request.headers.get('x-shopify-hmac-sha256') ?? ''
  const domain = request.headers.get('x-shopify-shop-domain') ?? ''

  const business = await prisma.business.findFirst({
    where: { shopifyDomain: domain },
  })

  if (!business) {
    return new Response('Business not found', { status: 404 })
  }

  if (business.shopifyWebhookSecret) {
    const valid = verifyWebhookSignature(rawBody, hmac, business.shopifyWebhookSecret)
    if (!valid) return new Response('Invalid signature', { status: 401 })
  }

  let order: ShopifyOrder
  try {
    order = JSON.parse(rawBody) as ShopifyOrder
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  try {
    const existingOrder = await prisma.order.findUnique({
      where: { businessId_shopifyOrderId: { businessId: business.id, shopifyOrderId: String(order.id) } },
    })

    if (existingOrder) return new Response('Already processed', { status: 200 })

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

    analyzeInBackground(dbOrder.id, business.id, order)

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response('Internal error', { status: 500 })
  }
}

async function analyzeInBackground(orderId: string, businessId: string, order: ShopifyOrder) {
  try {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) return

    const config: BusinessConfig = {
      productCosts: business.productCosts as any,
      discountRules: business.discountRules as any,
      paymentSettings: business.paymentSettings as any,
      aiNotes: business.aiNotes ?? '',
    }

    const analysis = await analyzeOrder(order, config)

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
  } catch (error) {
    console.error('Background analysis error:', error)
    await prisma.order.update({ where: { id: orderId }, data: { status: 'error' } })
  }
}
