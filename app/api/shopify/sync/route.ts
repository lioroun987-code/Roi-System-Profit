import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchShopifyOrders } from '@/lib/shopify'
import { analyzeOrder } from '@/lib/claude'
import { BusinessConfig, ShopifyOrder } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, daysBack = 30 } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })
  if (!business.shopifyDomain || !business.shopifyAccessToken) {
    return Response.json({ error: 'Shopify not configured' }, { status: 400 })
  }

  // daysBack can be fractional (e.g. 0.1 = ~2.4 hours)
  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

  try {
    const orders = await fetchShopifyOrders(
      business.shopifyDomain,
      business.shopifyAccessToken,
      { created_at_min: sinceDate.toISOString(), limit: 250 }
    )

    const config: BusinessConfig = {
      productCosts: business.productCosts as any,
      discountRules: business.discountRules as any,
      paymentSettings: business.paymentSettings as any,
      aiNotes: business.aiNotes ?? '',
    }

    let imported = 0
    let skipped = 0
    let errors = 0

    for (const order of orders) {
      const existing = await prisma.order.findUnique({
        where: { businessId_shopifyOrderId: { businessId: business.id, shopifyOrderId: String(order.id) } },
      })

      if (existing) { skipped++; continue }

      try {
        const analysis = await analyzeOrder(order as ShopifyOrder, config)

        await prisma.order.create({
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

        imported++
      } catch (err) {
        console.error(`Failed to process order ${order.order_number}:`, err)
        await prisma.order.create({
          data: {
            businessId: business.id,
            shopifyOrderId: String(order.id),
            orderNumber: String(order.order_number),
            orderDate: new Date(order.created_at),
            rawData: order as any,
            status: 'error',
          },
        }).catch(() => {})
        errors++
      }
    }

    return Response.json({ imported, skipped, errors, total: orders.length })
  } catch (error) {
    console.error('Sync error:', error)
    return Response.json({ error: 'סנכרון נכשל' }, { status: 500 })
  }
}
