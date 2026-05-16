import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateOrderCost } from '@/lib/calculator'
import { analyzeOrder } from '@/lib/claude'
import { BusinessConfig, ShopifyOrder } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, cursor, reanalyze = false } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })
  if (!business.shopifyDomain || !business.shopifyAccessToken)
    return Response.json({ error: 'Shopify לא מחובר' }, { status: 400 })

  const config: BusinessConfig = {
    productCosts:   business.productCosts   as any,
    discountRules:  business.discountRules  as any,
    paymentSettings: business.paymentSettings as any,
    aiNotes:        business.aiNotes ?? '',
  }

  // Fetch a batch of orders from Shopify
  const BATCH = 20
  const params = new URLSearchParams({ limit: String(BATCH), status: 'any' })
  if (cursor) params.set('page_info', cursor)
  else params.set('order', 'created_at asc')  // oldest first so we don't miss any

  const shopifyRes = await fetch(
    `https://${business.shopifyDomain}/admin/api/2024-01/orders.json?${params}`,
    { headers: { 'X-Shopify-Access-Token': business.shopifyAccessToken! } }
  )

  if (!shopifyRes.ok) {
    const txt = await shopifyRes.text()
    return Response.json({ error: `Shopify error: ${txt}` }, { status: 400 })
  }

  const shopifyData = await shopifyRes.json()
  const orders: ShopifyOrder[] = shopifyData.orders ?? []

  // Extract next cursor from Link header
  const linkHeader = shopifyRes.headers.get('link') ?? ''
  const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/)
  const nextCursor = nextMatch?.[1] ?? null

  let processed = 0
  let skipped   = 0
  let usedAI    = 0
  let errors    = 0

  for (const order of orders) {
    try {
      // Skip if already analyzed
      const existing = await prisma.order.findUnique({
        where: { businessId_shopifyOrderId: { businessId, shopifyOrderId: String(order.id) } },
        select: { id: true, aiAnalysis: true },
      })
      if (existing?.aiAnalysis) { skipped++; continue }

      // Try deterministic first, fall back to AI
      let analysis = calculateOrderCost(order, config)
      if (!analysis) {
        analysis = await analyzeOrder(order, config)
        usedAI++
      }

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
          myCostUsd:      analysis.my_cost_breakdown.total_usd,
          myCostIls:      analysis.my_cost_ils,
          grossProfitIls: analysis.gross_profit_ils,
          paymentFeeIls:  analysis.payment_fee_ils,
          netProfitIls:   analysis.net_profit_ils,
          netProfitUsd:   analysis.net_profit_usd,
          paymentMethod:  analysis.payment_method,
          status:         'analyzed',
        },
      })

      processed++
    } catch (e) {
      console.error(`Order ${order.order_number} failed:`, e)
      errors++
    }
  }

  return Response.json({
    processed,
    skipped,
    usedAI,
    errors,
    batchSize:  orders.length,
    nextCursor,
    done:       !nextCursor || orders.length < BATCH,
  })
}
