import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForTokens } from '@/lib/sheets'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const businessId = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) redirect(`/integrations?error=sheets`)
  if (!code || !businessId) return Response.json({ error: 'Missing params' }, { status: 400 })

  // The redirect lands in the user's browser, so the session cookie is present.
  // Without an ownership check anyone could pass a foreign businessId in `state`
  // and overwrite that business's Google tokens.
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: (session.user as any).id },
  })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

  try {
    const tokens = await exchangeCodeForTokens(code)
    await prisma.business.update({
      where: { id: businessId },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
      },
    })
  } catch (err) {
    console.error('Google OAuth error:', err)
    redirect(`/integrations?error=sheets`)
  }

  redirect(`/integrations?connected=sheets&business=${businessId}`)
}
