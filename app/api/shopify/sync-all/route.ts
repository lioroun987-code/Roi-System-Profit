import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateOrderCost } from '@/lib/calculator'
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
  // NOTE: Shopify cursor pagination (page_info) allows ONLY "limit" alongside it.
  // All other filters must only appear on the first (non-cursor) request.
  const BATCH = 50
  const params = new URLSearchParams({ limit: String(BATCH) })
  if (cursor) {
    params.set('page_info', cursor)
  } else {
    params.set('status', 'any')
    params.set('order', 'created_at asc')  // oldest first so we don't miss any
  }

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

  // Batch-check which orders already exist
  const shopifyIds = orders.map(o => String(o.id))
  const existing = await prisma.order.findMany({
    where: { businessId, shopifyOrderId: { in: shopifyIds } },
    select: { shopifyOrderId: true, status: true },
  })
  const existingMap = new Map(existing.map(e => [e.shopifyOrderId, e.status]))

  for (const order of orders) {
    const sid = String(order.id)
    const existingStatus = existingMap.get(sid)

    // Skip already-analyzed orders unless reanalyze=true
    if (existingStatus === 'analyzed' && !reanalyze) { skipped++; continue }

    try {
      // Try deterministic calculator — no AI during bulk import (avoids timeout)
      const analysis = calculateOrderCost(order, config)

      const commonFields = {
        businessId,
        shopifyOrderId: sid,
        orderNumber:    String(order.order_number),
        orderDate:      new Date(order.created_at),
        customerName:   order.customer
          ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
          : null,
        customerEmail:  order.customer?.email ?? null,
        rawData:        order as any,
      }

      if (analysis) {
        await prisma.order.upsert({
          where: { businessId_shopifyOrderId: { businessId, shopifyOrderId: sid } },
          create: {
            ...commonFields,
            aiAnalysis:     analysis as any,
            orderSummary:   analysis.order_summary,
            storePrice:     analysis.store_price_breakdown.total,
            myCostUsd:      analysis.my_cost_breakdown.total_usd,
            myCostIls:      analysis.my_cost_ils,
            grossProfitIls: analysis.gross_profit_ils,
            paymentFeeIls:  analysis.payment_fee_ils,
            vatIls:         analysis.vat_ils,
            netProfitIls:   analysis.net_profit_ils,
            netProfitUsd:   analysis.net_profit_usd,
            paymentMethod:  analysis.payment_method,
            status:         'analyzed',
          },
          update: {
            rawData:        order as any,
            aiAnalysis:     analysis as any,
            orderSummary:   analysis.order_summary,
            storePrice:     analysis.store_price_breakdown.total,
            myCostUsd:      analysis.my_cost_breakdown.total_usd,
            myCostIls:      analysis.my_cost_ils,
            grossProfitIls: analysis.gross_profit_ils,
            paymentFeeIls:  analysis.payment_fee_ils,
            vatIls:         analysis.vat_ils,
            netProfitIls:   analysis.net_profit_ils,
            netProfitUsd:   analysis.net_profit_usd,
            paymentMethod:  analysis.payment_method,
            status:         'analyzed',
          },
        })
      } else {
        // Calculator can't handle — save rawData as pending for later reanalysis
        await prisma.order.upsert({
          where: { businessId_shopifyOrderId: { businessId, shopifyOrderId: sid } },
          create:  { ...commonFields, status: 'pending' },
          update:  { rawData: order as any },
        })
      }

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
