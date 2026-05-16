import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { id } = await params

  const order = await prisma.order.findFirst({
    where: { id, business: { userId } },
    select: { aiAnalysis: true },
  })

  if (!order) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ aiAnalysis: order.aiAnalysis })
}
