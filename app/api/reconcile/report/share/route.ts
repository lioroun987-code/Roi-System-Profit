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

  // Find most recent report to copy metadata
  const report = await prisma.reconcileReport.findFirst({
    where: { businessId },
    orderBy: { runAt: 'desc' },
  })

  if (!report) return Response.json({ error: 'No report found' }, { status: 404 })

  // Create a DEDICATED share copy — uses a special agentSheetName prefix so it's
  // never deleted when the user re-runs the reconcile (deleteMany filters on tab name)
  const shareRecord = await prisma.reconcileReport.create({
    data: {
      businessId,
      agentSheetId:   report.agentSheetId,
      agentSheetName: `__share__${Date.now()}`,  // never matches a real tab → never deleted
      ourSheetId:     report.ourSheetId,
      exchangeRate:   report.exchangeRate,
      results:        [],
      summary:        {},
      debug:          { reportHtml: html },
    },
  })

  return Response.json({ token: shareRecord.id })
}
