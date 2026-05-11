import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchDailyAdSpend } from '@/lib/facebook'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, dateFrom, dateTo } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })
  if (!business.fbAdAccountId || !business.fbAccessToken) {
    return Response.json({ error: 'Facebook Ads not configured' }, { status: 400 })
  }

  try {
    const insights = await fetchDailyAdSpend(
      business.fbAdAccountId,
      business.fbAccessToken,
      dateFrom,
      dateTo
    )

    let upserted = 0
    for (const insight of insights) {
      await prisma.adSpend.upsert({
        where: {
          businessId_date: {
            businessId: business.id,
            date: new Date(insight.date_start),
          },
        },
        update: {
          spend: parseFloat(insight.spend),
          impressions: parseInt(insight.impressions),
          clicks: parseInt(insight.clicks),
          reach: parseInt(insight.reach),
        },
        create: {
          businessId: business.id,
          date: new Date(insight.date_start),
          spend: parseFloat(insight.spend),
          impressions: parseInt(insight.impressions),
          clicks: parseInt(insight.clicks),
          reach: parseInt(insight.reach),
        },
      })
      upserted++
    }

    return Response.json({ synced: upserted })
  } catch (error) {
    console.error('Facebook sync error:', error)
    return Response.json({ error: 'סנכרון פייסבוק נכשל' }, { status: 500 })
  }
}
