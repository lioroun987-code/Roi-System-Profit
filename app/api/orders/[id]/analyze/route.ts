import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyzeOrder } from '@/lib/claude'
import { calculateOrderCost } from '@/lib/calculator'
import { BusinessConfig, ShopifyOrder } from '@/types'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { id } = await params

  const order = await prisma.order.findFirst({
    where: { id },
    include: { business: true },
  })

  if (!order) return Response.json({ error: 'Not found' }, { status: 404 })
  if (order.business.userId !== userId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Re-fetch business fresh from DB to get latest config (not cached)
    const business = await prisma.business.findUnique({ where: { id: order.businessId } })
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

    const config: BusinessConfig = {
      productCosts:    business.productCosts    as any,
      discountRules:   business.discountRules   as any,
      paymentSettings: business.paymentSettings as any,
      aiNotes:         business.aiNotes ?? '',
    }

    const shopifyOrder = order.rawData as unknown as ShopifyOrder

    // Log cost rules for debugging
    const costRules = (config.discountRules as any)?.costRules ?? []
    if (costRules.length > 0) {
      console.log(`[analyze] Applying ${costRules.length} cost rule(s) for order ${order.orderNumber}:`, costRules.map((r: any) => r.name))
    }

    // Try deterministic calculator first (picks up config changes instantly, no AI cache)
    const analysis = calculateOrderCost(shopifyOrder, config)
      ?? await analyzeOrder(shopifyOrder, config)

    console.log(`[analyze] Order ${order.orderNumber}: cost=${analysis.my_cost_ils?.toFixed(2)} items=${analysis.line_items_parsed?.map((i: any) => `${i.name}=$${i.unitCostUsd}`).join(', ')}`)

    const updated = await prisma.order.update({
      where: { id },
      data: {
        aiAnalysis: analysis as any,
        orderSummary: analysis.order_summary,
        storePrice: analysis.store_price_breakdown.total,
        myCostUsd: analysis.my_cost_breakdown.total_usd,
        myCostIls: analysis.my_cost_ils,
        grossProfitIls: analysis.gross_profit_ils,
        paymentFeeIls: analysis.payment_fee_ils,
        vatIls: analysis.vat_ils,
        netProfitIls: analysis.net_profit_ils,
        netProfitUsd: analysis.net_profit_usd,
        paymentMethod: analysis.payment_method,
        status: 'analyzed',
      },
    })

    return Response.json(updated)
  } catch (error) {
    console.error('Analysis error:', error)
    await prisma.order.update({ where: { id }, data: { status: 'error' } })
    return Response.json({ error: 'ניתוח ההזמנה נכשל' }, { status: 500 })
  }
}
