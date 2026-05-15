import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchShopifyOrders } from '@/lib/shopify'
import { analyzeOrder } from '@/lib/claude'
import { calculateOrderCost } from '@/lib/calculator'
import { BusinessConfig, ShopifyOrder } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, daysBack = 7 } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })
  if (!business.shopifyDomain || !business.shopifyAccessToken)
    return Response.json({ error: 'Shopify not configured' }, { status: 400 })

  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

  try {
    // ── 1. Fetch all Shopify orders (paginated) ──
    const shopifyOrders: ShopifyOrder[] = []
    let sinceId = '0'
    while (true) {
      const page = await fetchShopifyOrders(
        business.shopifyDomain!,
        business.shopifyAccessToken!,
        { created_at_min: sinceDate.toISOString(), limit: 250, since_id: sinceId }
      )
      if (!page.length) break
      shopifyOrders.push(...page)
      if (page.length < 250) break
      sinceId = String(page[page.length - 1].id)
    }

    if (!shopifyOrders.length) return Response.json({ imported: 0, skipped: 0, errors: 0, total: 0 })

    // ── 2. Batch check which orders already exist in DB (ONE query) ──
    const shopifyIds = shopifyOrders.map(o => String(o.id))
    const existing = await prisma.order.findMany({
      where: { businessId, shopifyOrderId: { in: shopifyIds } },
      select: { shopifyOrderId: true, aiAnalysis: true },
    })
    const existingIds    = new Set(existing.map(e => e.shopifyOrderId))
    const needsAnalysis  = new Set(
      existing.filter(e => !e.aiAnalysis).map(e => e.shopifyOrderId)
    )

    const newOrders  = shopifyOrders.filter(o => !existingIds.has(String(o.id)))
    const reanalyze  = shopifyOrders.filter(o => needsAnalysis.has(String(o.id)))
    const toProcess  = [...newOrders, ...reanalyze]

    const config: BusinessConfig = {
      productCosts:    business.productCosts    as any,
      discountRules:   business.discountRules   as any,
      paymentSettings: business.paymentSettings as any,
      aiNotes:         business.aiNotes ?? '',
    }

    // ── 3. Run calculator on ALL orders (synchronous, free, fast) ──
    const calculated: Array<{ order: ShopifyOrder; analysis: any }> = []
    const needsAI:    Array<ShopifyOrder>                           = []

    for (const order of toProcess) {
      const result = calculateOrderCost(order, config)
      if (result) calculated.push({ order, analysis: result })
      else         needsAI.push(order)
    }

    // ── 4. Batch insert calculated orders (ONE createMany call) ──
    let imported = 0
    let errors   = 0

    if (calculated.length > 0) {
      const rows = calculated.map(({ order, analysis }) => ({
        businessId,
        shopifyOrderId:  String(order.id),
        orderNumber:     String(order.order_number),
        orderDate:       new Date(order.created_at),
        customerName:    order.customer
          ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
          : null,
        customerEmail:   order.customer?.email ?? null,
        rawData:         order as any,
        aiAnalysis:      analysis as any,
        orderSummary:    analysis.order_summary,
        storePrice:      analysis.store_price_breakdown.total,
        myCostUsd:       analysis.my_cost_breakdown.total_usd,
        myCostIls:       analysis.my_cost_ils,
        grossProfitIls:  analysis.gross_profit_ils,
        paymentFeeIls:   analysis.payment_fee_ils,
        vatIls:          analysis.vat_ils,
        netProfitIls:    analysis.net_profit_ils,
        netProfitUsd:    analysis.net_profit_usd,
        paymentMethod:   analysis.payment_method,
        status:          'analyzed',
      }))

      // skipDuplicates handles race conditions gracefully
      const result = await prisma.order.createMany({ data: rows, skipDuplicates: true })
      imported += result.count
    }

    // ── 5. AI analysis in parallel batches (5 at a time) ──
    const AI_CONCURRENCY = 5
    for (let i = 0; i < needsAI.length; i += AI_CONCURRENCY) {
      const batch = needsAI.slice(i, i + AI_CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map(async order => {
          const analysis = await analyzeOrder(order, config)
          await prisma.order.upsert({
            where: { businessId_shopifyOrderId: { businessId, shopifyOrderId: String(order.id) } },
            create: {
              businessId,
              shopifyOrderId:  String(order.id),
              orderNumber:     String(order.order_number),
              orderDate:       new Date(order.created_at),
              customerName:    order.customer
                ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
                : null,
              customerEmail:   order.customer?.email ?? null,
              rawData:         order as any,
              aiAnalysis:      analysis as any,
              orderSummary:    analysis.order_summary,
              storePrice:      analysis.store_price_breakdown.total,
              myCostUsd:       analysis.my_cost_breakdown.total_usd,
              myCostIls:       analysis.my_cost_ils,
              grossProfitIls:  analysis.gross_profit_ils,
              paymentFeeIls:   analysis.payment_fee_ils,
              vatIls:          analysis.vat_ils,
              netProfitIls:    analysis.net_profit_ils,
              netProfitUsd:    analysis.net_profit_usd,
              paymentMethod:   analysis.payment_method,
              status:          'analyzed',
            },
            update: {
              aiAnalysis:     analysis as any,
              orderSummary:   analysis.order_summary,
              storePrice:     analysis.store_price_breakdown.total,
              myCostIls:      analysis.my_cost_ils,
              netProfitIls:   analysis.net_profit_ils,
              status:         'analyzed',
            },
          })
          return order
        })
      )
      for (const r of results) {
        if (r.status === 'fulfilled') imported++
        else errors++
      }
    }

    return Response.json({
      imported,
      skipped:     existingIds.size - needsAnalysis.size,
      errors,
      total:       shopifyOrders.length,
      calculatorUsed: calculated.length,
      aiUsed:      needsAI.length,
    })

  } catch (error) {
    console.error('Sync error:', error)
    return Response.json({ error: 'סנכרון נכשל' }, { status: 500 })
  }
}
