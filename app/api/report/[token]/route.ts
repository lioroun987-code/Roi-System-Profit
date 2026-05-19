import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const report = await prisma.reconcileReport.findUnique({
    where: { shareToken: token },
    select: { reportHtml: true, agentSheetName: true, runAt: true },
  })

  if (!report?.reportHtml) {
    return new Response('Report not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }

  return new Response(report.reportHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
