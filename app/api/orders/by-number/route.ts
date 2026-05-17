import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { searchParams } = request.nextUrl
  const businessId  = searchParams.get('businessId')
  const orderNumber = searchParams.get('orderNumber')

  if (!businessId || !orderNumber) return Response.json({ error: 'Missing params' }, { status: 400 })

  const order = await prisma.order.findFirst({
    where: { businessId, orderNumber, business: { userId } },
    select: {
      orderNumber: true,
      orderDate:   true,
      orderSummary: true,
      storePrice:   true,
      myCostIls:    true,
      netProfitIls: true,
      paymentMethod: true,
      aiAnalysis:   true,
      status:       true,
    },
  })

  if (!order) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(order)
}
