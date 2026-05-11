import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function authorize(businessId: string, userId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId },
  })
  return business
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const business = await authorize(id, userId)

  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(business)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const existing = await authorize(id, userId)

  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json()
    const allowedFields = [
      'name', 'description', 'productCosts', 'discountRules', 'paymentSettings', 'aiNotes',
      'shopifyDomain', 'shopifyApiKey', 'shopifyApiSecret', 'shopifyAccessToken', 'shopifyWebhookSecret',
      'fbAdAccountId', 'fbAccessToken', 'googleSheetsId',
    ]

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) data[field] = body[field]
    }

    const updated = await prisma.business.update({ where: { id }, data })
    return Response.json(updated)
  } catch (error) {
    console.error('Update business error:', error)
    return Response.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const existing = await authorize(id, userId)

  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.business.delete({ where: { id } })
  return Response.json({ success: true })
}
