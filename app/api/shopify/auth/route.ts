import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const shop = request.nextUrl.searchParams.get('shop')
  const businessId = request.nextUrl.searchParams.get('businessId')

  if (!shop || !businessId) {
    return Response.json({ error: 'shop and businessId required' }, { status: 400 })
  }

  const userId = (session.user as any).id
  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  // Save the shop domain first
  await prisma.business.update({
    where: { id: businessId },
    data: { shopifyDomain: shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com` },
  })

  const apiKey    = process.env.SHOPIFY_API_KEY
  const scopes    = 'read_orders,read_products'
  const returnTo  = request.nextUrl.searchParams.get('returnTo') ?? 'integrations'
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/shopify/callback`
  const shopDomain  = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`
  // Encode returnTo in state so callback knows where to redirect
  const state = `${businessId}_${returnTo}_${crypto.randomBytes(8).toString('hex')}`

  const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

  redirect(authUrl)
}
