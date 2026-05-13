import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import { getGoogleAuthClient } from '@/lib/sheets'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const businessId = request.nextUrl.searchParams.get('businessId')
  const sheetId = request.nextUrl.searchParams.get('sheetId')

  if (!businessId || !sheetId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business?.googleRefreshToken) return Response.json({ tabs: [] })

  try {
    const auth = getGoogleAuthClient(business.googleRefreshToken)
    const sheets = google.sheets({ version: 'v4', auth })
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const tabs = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '').filter(Boolean)
    return Response.json({ tabs })
  } catch {
    return Response.json({ tabs: [] })
  }
}
