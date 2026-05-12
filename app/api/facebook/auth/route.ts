import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) return Response.json({ error: 'businessId required' }, { status: 400 })

  const appId = process.env.FACEBOOK_APP_ID
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/facebook/callback`
  const scope = 'ads_read,business_management,ads_management'
  const state = businessId

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`

  redirect(authUrl)
}
