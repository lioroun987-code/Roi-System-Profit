import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — load all exclusions for a business
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) return Response.json({ error: 'businessId חסר' }, { status: 400 })

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  const exclusions = (business.productCosts as any)?.businessUseExclusions ?? {}
  return Response.json({ exclusions })
}

// POST — add or remove an exclusion
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { businessId, orderNumber, remove = false } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

  const pc = business.productCosts as any ?? {}
  const exclusions = { ...(pc.businessUseExclusions ?? {}) }

  if (remove) {
    delete exclusions[orderNumber]
  } else {
    exclusions[orderNumber] = new Date().toISOString()
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { productCosts: { ...pc, businessUseExclusions: exclusions } },
  })

  return Response.json({ exclusions })
}
