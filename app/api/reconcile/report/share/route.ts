import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, html } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  // Find most recent report and store HTML in debug field
  const report = await prisma.reconcileReport.findFirst({
    where: { businessId },
    orderBy: { runAt: 'desc' },
  })

  if (!report) return Response.json({ error: 'No report found' }, { status: 404 })

  await prisma.reconcileReport.update({
    where: { id: report.id },
    data: { debug: { ...(report.debug as any ?? {}), reportHtml: html } },
  })

  // Use the report's cuid as share token — already unique and hard to guess
  return Response.json({ token: report.id })
}
