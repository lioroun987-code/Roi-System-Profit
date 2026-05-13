import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForTokens } from '@/lib/sheets'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const businessId = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) redirect(`/integrations?error=sheets`)
  if (!code || !businessId) return Response.json({ error: 'Missing params' }, { status: 400 })

  // Verify business exists
  const business = await prisma.business.findUnique({ where: { id: businessId } })
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
