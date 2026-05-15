import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const businessId = request.nextUrl.searchParams.get('businessId')

  let businessIds: string[]

  if (businessId) {
    const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
    if (!business) return Response.json({ error: 'Not found' }, { status: 404 })
    businessIds = [businessId]
  } else {
    const businesses = await prisma.business.findMany({ where: { userId }, select: { id: true } })
    businessIds = businesses.map((b: { id: string }) => b.id)
  }

  const now        = new Date()
  const todayStart = startOfDay(now)
  const todayEnd   = endOfDay(now)
  const weekStart  = startOfDay(subDays(now, 7))
  const monthStart = startOfDay(subDays(now, 30))

  const businessFilter = { businessId: { in: businessIds } }

  // Fetch all orders for each period (aggregate in JS — avoids groupBy timestamp bug)
  const [allTodayOrders, allWeekOrders, allMonthOrders, todayAdSpend, weekAdSpend, monthAdSpend] =
    await Promise.all([
      prisma.order.findMany({
        where: { ...businessFilter, orderDate: { gte: todayStart, lte: todayEnd }, status: 'analyzed' },
        select: { storePrice: true, netProfitIls: true, grossProfitIls: true, myCostIls: true },
      }),
      prisma.order.findMany({
        where: { ...businessFilter, orderDate: { gte: weekStart }, status: 'analyzed' },
        select: { storePrice: true, netProfitIls: true },
      }),
      prisma.order.findMany({
        where: { ...businessFilter, orderDate: { gte: monthStart }, status: 'analyzed' },
        select: { orderDate: true, storePrice: true, netProfitIls: true },
      }),
      prisma.adSpend.aggregate({
        where: { ...businessFilter, date: { gte: todayStart, lte: todayEnd } },
        _sum: { spend: true },
      }),
      prisma.adSpend.aggregate({
        where: { ...businessFilter, date: { gte: weekStart } },
        _sum: { spend: true },
      }),
      prisma.adSpend.aggregate({
        where: { ...businessFilter, date: { gte: monthStart } },
        _sum: { spend: true },
      }),
    ])

  const sumRevenue = (orders: Array<{ storePrice: number | null }>) =>
    orders.reduce((s, o) => s + (o.storePrice ?? 0), 0)

  const sumProfit = (orders: Array<{ netProfitIls: number | null }>) =>
    orders.reduce((s, o) => s + (o.netProfitIls ?? 0), 0)

  const todayAdSpendAmount = todayAdSpend._sum.spend ?? 0
  const todayRevenue       = sumRevenue(allTodayOrders)

  const stats = {
    todayRevenue,
    todayProfit:  sumProfit(allTodayOrders),
    todayCost:    allTodayOrders.reduce((s, o) => s + ((o.grossProfitIls ?? 0) - (o.netProfitIls ?? 0)), 0),
    todayOrders:  allTodayOrders.length,
    todayAdSpend: todayAdSpendAmount,
    todayRoas:    todayAdSpendAmount > 0 ? todayRevenue / todayAdSpendAmount : 0,
    weekRevenue:  sumRevenue(allWeekOrders),
    weekProfit:   sumProfit(allWeekOrders),
    weekAdSpend:  weekAdSpend._sum.spend ?? 0,
    monthRevenue: sumRevenue(allMonthOrders),
    monthProfit:  sumProfit(allMonthOrders),
    monthAdSpend: monthAdSpend._sum.spend ?? 0,
  }

  // ── Chart: aggregate by calendar day in JS (avoids Prisma groupBy timestamp bug) ──
  const dailySpendRows = await prisma.adSpend.findMany({
    where: { ...businessFilter, date: { gte: monthStart } },
    select: { date: true, spend: true },
  })

  const spendByDate = new Map<string, number>()
  for (const row of dailySpendRows) {
    const d = new Date(row.date).toISOString().split('T')[0]
    spendByDate.set(d, (spendByDate.get(d) ?? 0) + row.spend)
  }

  // Aggregate orders by ISO date string
  const revenueByDay = new Map<string, number>()
  const profitByDay  = new Map<string, number>()

  for (const order of allMonthOrders) {
    const d = new Date(order.orderDate).toISOString().split('T')[0]
    revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + (order.storePrice    ?? 0))
    profitByDay.set(d,  (profitByDay.get(d)  ?? 0) + (order.netProfitIls  ?? 0))
  }

  // Build sorted chart array
  const allDays = new Set([...revenueByDay.keys(), ...spendByDate.keys()])
  const chartData = [...allDays]
    .sort()   // ISO strings sort correctly
    .map(isoDate => ({
      date:     new Date(isoDate).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' }),
      isoDate,
      revenue:  parseFloat((revenueByDay.get(isoDate) ?? 0).toFixed(2)),
      profit:   parseFloat((profitByDay.get(isoDate)  ?? 0).toFixed(2)),
      adSpend:  spendByDate.get(isoDate) ?? 0,
    }))

  return Response.json({ stats, chartData })
}
