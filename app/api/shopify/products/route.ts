import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) return Response.json({ error: 'businessId required' }, { status: 400 })

  const userId = (session.user as any).id
  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  if (!business.shopifyDomain || !business.shopifyAccessToken) {
    return Response.json({ error: 'Shopify not connected' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://${business.shopifyDomain}/admin/api/2024-01/products.json?status=active&limit=250`,
      {
        headers: {
          'X-Shopify-Access-Token': business.shopifyAccessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) throw new Error(`Shopify error ${res.status}`)
    const data = await res.json()

    const products = (data.products ?? []).map((p: any) => ({
      id: String(p.id),
      title: p.title,
      image: p.image?.src ?? null,
      variants: p.variants.map((v: any) => ({
        id: String(v.id),
        title: v.title,
        sku: v.sku,
        price: v.price,
      })),
    }))

    return Response.json({ products })
  } catch (error) {
    console.error('Shopify products error:', error)
    return Response.json({ error: 'שגיאה במשיכת מוצרים' }, { status: 500 })
  }
}
