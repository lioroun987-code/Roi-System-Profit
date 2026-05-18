import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const searchParams = request.nextUrl.searchParams
  const businessId = searchParams.get('businessId')
  const dateFrom   = searchParams.get('dateFrom')
  const dateTo     = searchParams.get('dateTo')
  const search     = searchParams.get('search')?.trim() ?? ''
  const page       = parseInt(searchParams.get('page') ?? '1')
  const limit      = parseInt(searchParams.get('limit') ?? '50')

  if (!businessId) return Response.json({ error: 'businessId required' }, { status: 400 })

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  const where: any = { businessId }
  if (dateFrom || dateTo) {
    where.orderDate = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    }
  }
  if (search) {
    where.OR = [
      { orderNumber:   { contains: search } },
      { customerName:  { contains: search, mode: 'insensitive' } },
      { orderSummary:  { contains: search, mode: 'insensitive' } },
    ]
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        orderDate: true,
        customerName: true,
        orderSummary: true,
        storePrice: true,
        myCostUsd: true,
        myCostIls: true,
        grossProfitIls: true,
        netProfitIls: true,
        paymentFeeIls: true,
        vatIls: true,
        adSpendAlloc: true,
        paymentMethod: true,
        status: true,
      } as const,
    }),
    prisma.order.count({ where }),
  ])

  return Response.json({ orders, total, page, limit })
}
