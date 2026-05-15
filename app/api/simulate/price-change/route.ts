import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const {
    businessId,
    mode,              // 'cost' | 'selling'
    productKey,        // e.g. "123_456"
    newValueUsd,       // new cost in USD (mode=cost)
    newValueIls,       // new selling price in ILS (mode=selling)
    fromOrderNumber,   // e.g. "3500"
    toOrderNumber,     // optional upper bound
  } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  const pc = business.productCosts as any
  const exchangeRate = pc?.exchangeRate ?? 3.7

  // Fetch relevant orders from DB
  const where: any = { businessId, status: 'analyzed' }
  if (fromOrderNumber) {
    where.orderNumber = { gte: fromOrderNumber }
  }
  if (toOrderNumber) {
    where.orderNumber = { ...where.orderNumber, lte: toOrderNumber }
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      orderNumber: true,
      orderDate: true,
      aiAnalysis: true,
      storePrice: true,
      myCostIls: true,
      netProfitIls: true,
    },
    orderBy: { orderNumber: 'asc' },
    take: 2000,
  })

  // Filter to orders that contain this product
  const relevant = orders.filter(o => {
    const a = o.aiAnalysis as any
    if (!a?.line_items_parsed) return false
    // Match by product key embedded in name — or by any item if no key
    if (!productKey) return true
    // Try to match by product title from catalog
    const catalog = pc?.customProductCosts?.[productKey]
    if (!catalog) return true
    return a.line_items_parsed.some((item: any) =>
      item.name?.includes(catalog.productTitle) ||
      item.name?.includes(catalog.variantTitle)
    )
  })

  let originalTotalProfit  = 0
  let simulatedTotalProfit = 0
  let ordersAffected = 0

  const rows: any[] = []

  for (const order of relevant) {
    const a = order.aiAnalysis as any
    if (!a) continue

    const origProfit = order.netProfitIls ?? 0
    originalTotalProfit += origProfit

    const catalog = productKey ? (pc?.customProductCosts?.[productKey]) : null

    let simRevenue = a.store_price_breakdown?.total ?? (order.storePrice ?? 0)
    let simCostIls = order.myCostIls ?? 0

    if (catalog && mode === 'cost' && newValueUsd != null) {
      // Find matching line items and adjust cost
      const items = a.line_items_parsed ?? []
      const oldCostUsd = catalog.costUsd ?? 0
      for (const item of items) {
        const matches = item.name?.includes(catalog.productTitle)
        if (matches) {
          const costDiffUsd = (newValueUsd - oldCostUsd) * item.quantity
          simCostIls += costDiffUsd * exchangeRate
        }
      }
    } else if (catalog && mode === 'selling' && newValueIls != null) {
      // Find matching line items and adjust revenue
      const items = a.line_items_parsed ?? []
      const oldPriceIls = catalog.sellingPriceIls ?? 0
      for (const item of items) {
        const matches = item.name?.includes(catalog.productTitle)
        if (matches) {
          const revDiff = (newValueIls - oldPriceIls) * item.quantity
          simRevenue += revDiff
        }
      }
    }

    const paymentFee = a.payment_fee_ils ?? 0
    const vatIls     = a.vat_ils ?? 0
    const simGross   = simRevenue - simCostIls
    const simProfit  = simGross - paymentFee - vatIls

    simulatedTotalProfit += simProfit

    if (Math.abs(simProfit - origProfit) > 0.01) {
      ordersAffected++
      rows.push({
        orderNumber:  order.orderNumber,
        orderDate:    order.orderDate,
        origProfit:   parseFloat(origProfit.toFixed(2)),
        simProfit:    parseFloat(simProfit.toFixed(2)),
        diff:         parseFloat((simProfit - origProfit).toFixed(2)),
      })
    }
  }

  return Response.json({
    totalOrders:         relevant.length,
    ordersAffected,
    originalTotalProfit: parseFloat(originalTotalProfit.toFixed(2)),
    simulatedTotalProfit: parseFloat(simulatedTotalProfit.toFixed(2)),
    totalDiff:           parseFloat((simulatedTotalProfit - originalTotalProfit).toFixed(2)),
    rows: rows.slice(0, 100),
  })
}
