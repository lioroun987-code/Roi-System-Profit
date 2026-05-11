import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForTokens } from '@/lib/sheets'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const code = request.nextUrl.searchParams.get('code')
  const businessId = request.nextUrl.searchParams.get('state')

  if (!code || !businessId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const userId = (session.user as any).id
  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const tokens = await exchangeCodeForTokens(code)
    await prisma.business.update({
      where: { id: businessId },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
      },
    })
  } catch (error) {
    console.error('Google OAuth error:', error)
    return Response.json({ error: 'OAuth failed' }, { status: 500 })
  }

  redirect(`/integrations?connected=sheets&business=${businessId}`)
}
