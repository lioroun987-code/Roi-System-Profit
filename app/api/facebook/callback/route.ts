import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    redirect(`/integrations?error=facebook&business=${state}`)
  }

  const businessId = state!
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/facebook/callback`

  try {
    // Exchange code for token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    )

    if (!tokenRes.ok) throw new Error('Token exchange failed')
    const { access_token } = await tokenRes.json()

    // Get long-lived token
    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${access_token}`
    )
    const longToken = longRes.ok ? (await longRes.json()).access_token : access_token

    // Get ad accounts
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_id&access_token=${longToken}`
    )
    const accountsData = await accountsRes.json()
    const firstAccount = accountsData.data?.[0]

    await prisma.business.update({
      where: { id: businessId },
      data: {
        fbAccessToken: longToken,
        ...(firstAccount && { fbAdAccountId: firstAccount.account_id }),
      },
    })
  } catch (err) {
    console.error('Facebook OAuth error:', err)
    redirect(`/integrations?error=facebook&business=${businessId}`)
  }

  redirect(`/integrations?connected=facebook&business=${businessId}`)
}
