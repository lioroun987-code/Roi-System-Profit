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

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekStart = startOfDay(subDays(now, 7))
  const monthStart = startOfDay(subDays(now, 30))

  const businessFilter = { businessId: { in: businessIds } }

  const [todayOrders, weekOrders, monthOrders, todayAdSpend, weekAdSpend, monthAdSpend] =
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
        select: { storePrice: true, netProfitIls: true },
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
    orders.reduce((sum, o) => sum + (o.storePrice ?? 0), 0)

  const sumProfit = (orders: Array<{ netProfitIls: number | null }>) =>
    orders.reduce((sum, o) => sum + (o.netProfitIls ?? 0), 0)

  const todayAdSpendAmount = todayAdSpend._sum.spend ?? 0
  const todayRevenue = sumRevenue(todayOrders)

  const stats = {
    todayRevenue,
    todayProfit: sumProfit(todayOrders),
    todayCost: todayOrders.reduce(
      (sum: number, o) => sum + ((o.grossProfitIls ?? 0) - (o.netProfitIls ?? 0)),
      0
    ),
    todayOrders: todayOrders.length,
    todayAdSpend: todayAdSpendAmount,
    todayRoas: todayAdSpendAmount > 0 ? todayRevenue / todayAdSpendAmount : 0,
    weekRevenue: sumRevenue(weekOrders),
    weekProfit: sumProfit(weekOrders),
    weekAdSpend: weekAdSpend._sum.spend ?? 0,
    monthRevenue: sumRevenue(monthOrders),
    monthProfit: sumProfit(monthOrders),
    monthAdSpend: monthAdSpend._sum.spend ?? 0,
  }

  // Daily chart data (last 30 days)
  const dailyOrders = await prisma.order.groupBy({
    by: ['orderDate'],
    where: { ...businessFilter, orderDate: { gte: monthStart }, status: 'analyzed' },
    _sum: { storePrice: true, netProfitIls: true },
    _count: true,
  })

  const dailySpend = await prisma.adSpend.findMany({
    where: { ...businessFilter, date: { gte: monthStart } },
    select: { date: true, spend: true },
  })

  const spendByDate = new Map(dailySpend.map(s => [s.date.toISOString().split('T')[0], s.spend]))

  const chartData = dailyOrders
    .map(d => {
      const dateStr = new Date(d.orderDate).toISOString().split('T')[0]
      return {
        date: new Date(d.orderDate).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' }),
        revenue: d._sum.storePrice ?? 0,
        profit: d._sum.netProfitIls ?? 0,
        adSpend: spendByDate.get(dateStr) ?? 0,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return Response.json({ stats, chartData })
}
