import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const businesses = await prisma.business.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      shopifyDomain: true,
      fbAdAccountId: true,
      googleSheetsId: true,
      onboardingCompleted: true,
      onboardingStep: true,
      createdAt: true,
    },
  })

  return Response.json(businesses)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id

  try {
    const body = await request.json()
    const { name, description } = createSchema.parse(body)

    const defaultProductCosts = {
      dealCost: 8.5,
      coolDealCost: 9.5,
      bottleCost: 6,
      singleCapsuleCost: 0.85,
      pack3Price: 69,
      pack7Price: 139,
      secondUnitDiscount: 2,
      homeDeliveryCostUsd: 3,
      homeDeliveryChargeIls: 25,
      pickupFeeThresholdIls: 200,
      pickupFeeAmountIls: 10,
      exchangeRate: 3.7,
    }

    const defaultDiscountRules = {
      qty2Percent: 10,
      qty3Percent: 15,
      section10Percent: true,
      section15Percent: true,
      coupon50Ils: true,
      surpriseCapsuleCostUsd: 0.85,
      giftCapsuleThresholdIls: 350,
      giftCapsuleCostUsd: 0.85,
    }

    const defaultPaymentSettings = {
      vatEnabled: false,
      vatPercent: 17,
      paymentMethods: [
        { name: 'Bit', feePercent: 3, enabled: true },
        { name: 'כרטיס אשראי', feePercent: 1.5, enabled: true },
        { name: 'Apple Pay', feePercent: 1.5, enabled: true },
        { name: 'Google Pay', feePercent: 1.5, enabled: true },
        { name: 'PayPal', feePercent: 4.5, enabled: false },
        { name: 'מזומן', feePercent: 0, enabled: false },
        { name: 'HYP / Cardcom', feePercent: 1.5, enabled: false },
      ],
    }

    const business = await prisma.business.create({
      data: {
        userId,
        name,
        description,
        productCosts: defaultProductCosts,
        discountRules: defaultDiscountRules,
        paymentSettings: defaultPaymentSettings,
      },
    })

    return Response.json(business, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'נתונים לא תקינים' }, { status: 400 })
    }
    console.error('Create business error:', error)
    return Response.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
