import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, html } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  const token = crypto.randomBytes(16).toString('hex')

  // Save to the most recent reconcile report for this business
  const report = await prisma.reconcileReport.findFirst({
    where: { businessId },
    orderBy: { runAt: 'desc' },
  })

  if (report) {
    await prisma.reconcileReport.update({
      where: { id: report.id },
      data: { reportHtml: html, shareToken: token },
    })
  }

  return Response.json({ token })
}
