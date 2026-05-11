import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exportOrdersToSheet } from '@/lib/sheets'
import { OrderRow } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, dateFrom, dateTo } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })
  if (!business.googleSheetsId || !business.googleRefreshToken) {
    return Response.json({ error: 'Google Sheets not configured' }, { status: 400 })
  }

  const where: Record<string, unknown> = { businessId, status: 'analyzed' }
  if (dateFrom || dateTo) {
    where.orderDate = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    }
  }

  const orders = await prisma.order.findMany({ where, orderBy: { orderDate: 'asc' } })

  const rows: OrderRow[] = orders.map((o: any) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    orderDate: o.orderDate.toISOString(),
    customerName: o.customerName,
    orderSummary: o.orderSummary,
    storePrice: o.storePrice,
    myCostUsd: o.myCostUsd,
    myCostIls: o.myCostIls,
    grossProfitIls: o.grossProfitIls,
    netProfitIls: o.netProfitIls,
    paymentFeeIls: o.paymentFeeIls,
    vatIls: o.vatIls,
    adSpendAlloc: o.adSpendAlloc,
    paymentMethod: o.paymentMethod,
    status: o.status,
    aiAnalysis: o.aiAnalysis as any,
  }))

  try {
    await exportOrdersToSheet(business.googleRefreshToken, business.googleSheetsId, rows)
    return Response.json({ exported: rows.length })
  } catch (error) {
    console.error('Sheets export error:', error)
    return Response.json({ error: 'ייצוא נכשל' }, { status: 500 })
  }
}
