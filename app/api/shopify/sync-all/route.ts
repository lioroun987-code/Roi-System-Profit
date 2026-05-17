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
  // sinceId = last Shopify order ID processed (0 = start from beginning)
  const { businessId, sinceId = '0', reanalyze = false } = await request.json()

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

  // since_id pagination: sort by ID asc, fetch orders with ID > sinceId
  // More reliable than cursor pagination for large stores
  const BATCH = 250
  const params = new URLSearchParams({
    limit:    String(BATCH),
    status:   'any',
    order:    'id asc',
    since_id: sinceId,
  })

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

  // Next sinceId = last order ID in this batch
  const nextSinceId = orders.length > 0 ? String(orders[orders.length - 1].id) : null

  let processed = 0, skipped = 0, errors = 0

  if (orders.length === 0) {
    return Response.json({ processed: 0, skipped: 0, errors: 0, batchSize: 0, nextCursor: null, done: true })
  }

  // ── 1. Single query: which orders already exist? ──
  const shopifyIds = orders.map(o => String(o.id))
  const existing   = await prisma.order.findMany({
    where:  { businessId, shopifyOrderId: { in: shopifyIds } },
    select: { shopifyOrderId: true, status: true },
  })
  const existingMap = new Map(existing.map(e => [e.shopifyOrderId, e.status]))

  // ── 2. Run calculator on all orders (sync, no I/O) ──
  type Row = { sid: string; order: ShopifyOrder; analysis: ReturnType<typeof calculateOrderCost> }
  const toProcess: Row[] = []

  for (const order of orders) {
    const sid = String(order.id)
    if (existingMap.get(sid) === 'analyzed' && !reanalyze) { skipped++; continue }
    toProcess.push({ sid, order, analysis: calculateOrderCost(order, config) })
  }

  if (toProcess.length === 0) {
    return Response.json({ processed: 0, skipped, errors: 0, batchSize: orders.length, nextCursor, done: !nextCursor || orders.length < BATCH })
  }

  // ── 3. Split into new vs existing ──
  const newRows      = toProcess.filter(r => !existingMap.has(r.sid))
  const existingRows = toProcess.filter(r =>  existingMap.has(r.sid))

  // ── 4. Bulk insert new orders in ONE query ──
  if (newRows.length > 0) {
    try {
      await prisma.order.createMany({
        skipDuplicates: true,
        data: newRows.map(({ sid, order, analysis }) => ({
          businessId,
          shopifyOrderId: sid,
          orderNumber:    String(order.order_number),
          orderDate:      new Date(order.created_at),
          customerName:   order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : null,
          customerEmail:  order.customer?.email ?? null,
          rawData:        order as any,
          status:         analysis ? 'analyzed' : 'pending',
          ...(analysis ? {
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
          } : {}),
        })),
      })
      processed += newRows.length
    } catch (e) {
      console.error('createMany failed:', e)
      errors += newRows.length
    }
  }

  // ── 5. Update existing orders in parallel (capped at 10 concurrent) ──
  const CAP = 10
  for (let i = 0; i < existingRows.length; i += CAP) {
    const batch = existingRows.slice(i, i + CAP)
    const results = await Promise.allSettled(batch.map(({ sid, order, analysis }) =>
      analysis
        ? prisma.order.update({
            where:  { businessId_shopifyOrderId: { businessId, shopifyOrderId: sid } },
            data: {
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
        : prisma.order.update({
            where: { businessId_shopifyOrderId: { businessId, shopifyOrderId: sid } },
            data:  { rawData: order as any, status: 'pending' },
          })
    ))
    for (const r of results) {
      if (r.status === 'fulfilled') processed++
      else errors++
    }
  }

  return Response.json({
    processed,
    skipped,
    errors,
    batchSize:  orders.length,
    nextCursor,
    done:       !nextCursor || orders.length < BATCH,
  })
}
