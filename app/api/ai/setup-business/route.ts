import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })
  if (!business.shopifyDomain || !business.shopifyAccessToken)
    return Response.json({ error: 'Shopify לא מחובר' }, { status: 400 })

  // Fetch 30 recent orders from Shopify
  let recentOrders: any[] = []
  try {
    const res = await fetch(
      `https://${business.shopifyDomain}/admin/api/2024-01/orders.json?limit=30&status=any`,
      { headers: { 'X-Shopify-Access-Token': business.shopifyAccessToken! } }
    )
    if (res.ok) {
      const data = await res.json()
      recentOrders = data.orders ?? []
    }
  } catch (e) {
    console.error('Failed to fetch orders for AI setup:', e)
  }

  if (recentOrders.length === 0)
    return Response.json({ error: 'לא נמצאו הזמנות ב-Shopify' }, { status: 400 })

  const productCosts = business.productCosts as any
  const customProducts = productCosts?.customProductCosts ?? {}
  const productList = Object.values(customProducts).map((p: any) =>
    `"${p.productTitle}"${p.variantTitle !== 'Default Title' ? ` / "${p.variantTitle}"` : ''}: $${p.costUsd} USD`
  ).join('\n')

  // Strip down orders to only what AI needs (save tokens)
  const ordersForAI = recentOrders.slice(0, 20).map(o => ({
    id: o.order_number,
    total: o.total_price,
    subtotal: o.subtotal_price,
    total_discounts: o.total_discounts,
    gateway: o.gateway,
    payment_gateway_names: o.payment_gateway_names,
    shipping_lines: o.shipping_lines?.map((s: any) => ({ title: s.title, price: s.price })),
    discount_applications: o.discount_applications?.map((d: any) => ({
      type: d.type, value_type: d.value_type, value: d.value,
      code: d.code, title: d.title,
    })),
    line_items: o.line_items?.map((i: any) => ({
      title: i.title, quantity: i.quantity, price: i.price,
      product_id: i.product_id, variant_id: i.variant_id,
    })),
  }))

  const prompt = `You are analyzing a Shopify store's order history to auto-configure a profitability tracking system.

## Product catalog:
${productList || 'Not configured yet'}

## Recent orders (${ordersForAI.length} orders):
${JSON.stringify(ordersForAI, null, 2)}

Analyze these orders and extract the business rules. Return ONLY valid JSON:
{
  "discountRules": {
    "qty2Percent": <number — percentage for 2 same-type main products, usually 10>,
    "qty3Percent": <number — percentage for 3+ same-type main products, usually 15>,
    "section10Percent": <boolean — does store use 10% section discounts?>,
    "section15Percent": <boolean — does store use 15% section discounts?>,
    "coupon50Ils": <boolean — does store use ₪50 fixed coupons?>,
    "surpriseCapsuleCostUsd": <number — cost of surprise/gift capsule in USD, default 0.85>,
    "giftCapsuleThresholdIls": <number — order threshold for free gift capsule, default 350>,
    "giftCapsuleCostUsd": <number — cost of gift capsule in USD, default 0.85>,
    "commonCouponAmounts": <array of numbers — fixed discount amounts seen in orders>
  },
  "paymentPatterns": {
    "primaryGateways": <array of gateway strings seen in orders>,
    "notes": <string — any payment patterns observed>
  },
  "shippingPatterns": {
    "homeDeliveryKeywords": <array of Hebrew/English keywords in shipping title that indicate home delivery>,
    "hasPickup": <boolean — does store offer pickup?>,
    "typicalHomeDeliveryCostUsd": <number — estimated shipping cost to business>,
    "notes": <string — shipping patterns observed>
  },
  "confidence": <number 0-100 — confidence in the extracted rules>,
  "summary": <string in Hebrew — brief summary of what was detected>
}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as any).text?.trim() ?? ''
  const jsonMatch = text.match(/```json\n?([\s\S]+?)\n?```/) || text.match(/(\{[\s\S]+\})/)
  if (!jsonMatch) return Response.json({ error: 'AI לא הצליח לנתח' }, { status: 500 })

  const detected = JSON.parse(jsonMatch[1] || jsonMatch[0])

  // Save detected discount rules
  await prisma.business.update({
    where: { id: businessId },
    data: {
      discountRules: detected.discountRules,
    },
  })

  return Response.json({ success: true, detected })
}
