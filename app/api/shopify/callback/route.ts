import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { registerWebhook } from '@/lib/shopify'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')

  if (!code || !shop || !state) {
    return Response.json({ error: 'Missing params' }, { status: 400 })
  }

  const businessId = state.split('_')[0]
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

  try {
    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    })

    if (!tokenRes.ok) throw new Error('Failed to get access token')
    const { access_token } = await tokenRes.json()

    await prisma.business.update({
      where: { id: businessId },
      data: { shopifyDomain: shop, shopifyAccessToken: access_token },
    })

    // Register webhook
    try {
      const webhookUrl = `${process.env.NEXTAUTH_URL}/api/shopify/webhook`
      await registerWebhook(shop, access_token, webhookUrl)
    } catch (e) {
      console.error('Webhook registration failed:', e)
    }
  } catch (error) {
    console.error('Shopify OAuth error:', error)
    redirect(`/integrations?error=shopify&business=${businessId}`)
  }

  redirect(`/integrations?connected=shopify&business=${businessId}`)
}
