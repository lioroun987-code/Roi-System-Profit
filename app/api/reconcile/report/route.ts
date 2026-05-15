import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, orderNumbers } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  const orders = await prisma.order.findMany({
    where: {
      businessId,
      orderNumber: { in: orderNumbers },
    },
    select: {
      orderNumber: true,
      orderDate: true,
      customerName: true,
      aiAnalysis: true,
      storePrice: true,
      myCostIls: true,
      netProfitIls: true,
      paymentMethod: true,
      orderSummary: true,
    },
  })

  const byOrderNum = Object.fromEntries(orders.map(o => [o.orderNumber, o]))
  return Response.json({ orders: byOrderNum })
}
