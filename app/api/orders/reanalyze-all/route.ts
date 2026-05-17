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
  const { businessId, cursor = 0 } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

  const config: BusinessConfig = {
    productCosts:    business.productCosts    as any,
    discountRules:   business.discountRules   as any,
    paymentSettings: business.paymentSettings as any,
    aiNotes:         business.aiNotes ?? '',
  }

  const BATCH = 50  // keep batches small to stay within Vercel's 10s function limit

  // Count total orders for progress
  const totalOrders = await prisma.order.count({ where: { businessId } })

  // Fetch batch from DB
  const orders = await prisma.order.findMany({
    where: { businessId },
    orderBy: { orderDate: 'asc' },
    skip:   cursor,
    take:   BATCH,
    select: {
      id: true,
      orderNumber: true,
      rawData: true,
      myCostIls: true,
      netProfitIls: true,
      status: true,
    },
  })

  if (orders.length === 0) {
    return Response.json({ done: true, processed: 0, changed: 0, failed: 0, skipped: 0, total: totalOrders, nextCursor: null })
  }

  let processed = 0
  let changed   = 0
  let failed    = 0
  let skipped   = 0

  // Run calculator on all orders (CPU only, no I/O)
  type UpdateRow = { id: string; data: any; costChanged: boolean }
  const updates: UpdateRow[] = []

  for (const order of orders) {
    if (!order.rawData) { skipped++; continue }
    try {
      const shopifyOrder = order.rawData as unknown as ShopifyOrder
      const analysis = calculateOrderCost(shopifyOrder, config)
      if (!analysis) {
        updates.push({ id: order.id, data: { status: 'pending' }, costChanged: false })
        continue
      }
      const costChanged   = Math.abs((order.myCostIls ?? 0)   - analysis.my_cost_ils)   > 0.01
      const profitChanged = Math.abs((order.netProfitIls ?? 0) - analysis.net_profit_ils) > 0.01
      const wasNotAnalyzed = order.status !== 'analyzed'
      updates.push({
        id: order.id,
        costChanged: costChanged || profitChanged || wasNotAnalyzed,
        data: {
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
    } catch (e) {
      console.error(`reanalyze-all: order ${order.orderNumber} failed:`, e)
      failed++
    }
  }

  // Write all updates in parallel (10 concurrent)
  const CAP = 10
  for (let i = 0; i < updates.length; i += CAP) {
    const batch = updates.slice(i, i + CAP)
    const results = await Promise.allSettled(
      batch.map(u => prisma.order.update({ where: { id: u.id }, data: u.data }))
    )
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        processed++
        if (updates[i + j].costChanged) changed++
      } else {
        failed++
      }
    }
  }

  const nextCursor    = cursor + orders.length
  const done          = orders.length < BATCH
  const percentDone   = Math.round((nextCursor / totalOrders) * 100)

  return Response.json({
    done,
    processed,
    changed,
    failed,
    skipped,
    total:      totalOrders,
    soFar:      nextCursor,
    percentDone,
    nextCursor: done ? null : nextCursor,
  })
}
