import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { registerWebhook } from '@/lib/shopify'
import { calculateOrderCost } from '@/lib/calculator'
import { analyzeOrder } from '@/lib/claude'
import { BusinessConfig } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function triggerFullSetup(businessId: string, shop: string, accessToken: string) {
  // 1. Fetch all products from Shopify and save to productCosts
  const productsRes = await fetch(
    `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,image,variants`,
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  )
  if (!productsRes.ok) return

  const { products } = await productsRes.json()
  const existing = await prisma.business.findUnique({ where: { id: businessId } })
  if (!existing) return

  const existingCosts = (existing.productCosts as any)?.customProductCosts ?? {}

  // Only add products not already configured
  const updatedCosts: Record<string, any> = { ...existingCosts }
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const key = `${p.id}_${v.id}`
      if (!updatedCosts[key]) {
        updatedCosts[key] = {
          productId:       String(p.id),
          variantId:       String(v.id),
          productTitle:    p.title,
          variantTitle:    v.title,
          costUsd:         0,   // User fills this in
          sellingPriceIls: parseFloat(v.price) || 0,
        }
      }
    }
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      productCosts: {
        ...(existing.productCosts as any),
        customProductCosts: updatedCosts,
      },
    },
  })

  // 2. Fetch recent orders for AI analysis of discount patterns
  const ordersRes = await fetch(
    `https://${shop}/admin/api/2024-01/orders.json?limit=20&status=any`,
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  )
  if (ordersRes.ok) {
    const { orders } = await ordersRes.json()
    if (orders?.length > 0) {
      try {
        const slim = orders.slice(0, 15).map((o: any) => ({
          total: o.total_price, discounts: o.total_discounts,
          gateway: o.gateway,
          shipping: o.shipping_lines?.map((s: any) => ({ title: s.title, price: s.price })),
          discount_apps: o.discount_applications?.map((d: any) => ({
            value_type: d.value_type, value: d.value, code: d.code, title: d.title,
          })),
        }))

        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `Analyze these Shopify orders and return discount rules as JSON only:
${JSON.stringify(slim)}

Return ONLY this JSON:
{"qty2Percent":10,"qty3Percent":15,"section10Percent":true,"section15Percent":true,"coupon50Ils":true,"surpriseCapsuleCostUsd":0.85,"giftCapsuleThresholdIls":350,"giftCapsuleCostUsd":0.85}`,
          }],
        })

        const text = (msg.content[0] as any).text?.trim() ?? ''
        const match = text.match(/\{[\s\S]+\}/)
        if (match) {
          const rules = JSON.parse(match[0])
          const biz = await prisma.business.findUnique({ where: { id: businessId } })
          if (biz && (!biz.discountRules || Object.keys(biz.discountRules as any).length === 0)) {
            await prisma.business.update({ where: { id: businessId }, data: { discountRules: rules } })
          }
        }
      } catch (e) {
        console.error('AI discount rule setup failed:', e)
      }
    }
  }

  // 3. Retroactively process all past orders in batches
  const biz = await prisma.business.findUnique({ where: { id: businessId } })
  if (!biz) return

  const config: BusinessConfig = {
    productCosts:    biz.productCosts    as any,
    discountRules:   biz.discountRules   as any,
    paymentSettings: biz.paymentSettings as any,
    aiNotes:         biz.aiNotes ?? '',
  }

  let sinceId = '0'
  while (true) {
    const batchRes = await fetch(
      `https://${shop}/admin/api/2024-01/orders.json?limit=20&status=any&since_id=${sinceId}&order=id+asc`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    )
    if (!batchRes.ok) break
    const { orders: batch } = await batchRes.json()
    if (!batch?.length) break

    for (const order of batch) {
      try {
        const exists = await prisma.order.findUnique({
          where: { businessId_shopifyOrderId: { businessId, shopifyOrderId: String(order.id) } },
          select: { aiAnalysis: true },
        })
        if (exists?.aiAnalysis) continue

        const analysis = calculateOrderCost(order, config) ?? await analyzeOrder(order, config)
        await prisma.order.upsert({
          where: { businessId_shopifyOrderId: { businessId, shopifyOrderId: String(order.id) } },
          create: {
            businessId, shopifyOrderId: String(order.id),
            orderNumber: String(order.order_number),
            orderDate: new Date(order.created_at),
            customerName: order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : null,
            customerEmail: order.customer?.email ?? null,
            rawData: order, aiAnalysis: analysis as any,
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
          update: {
            aiAnalysis: analysis as any, orderSummary: analysis.order_summary,
            storePrice: analysis.store_price_breakdown.total,
            myCostIls: analysis.my_cost_ils, netProfitIls: analysis.net_profit_ils,
            status: 'analyzed',
          },
        })
      } catch { /* non-fatal */ }
    }

    sinceId = String(batch[batch.length - 1].id)
    if (batch.length < 20) break
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')

  if (!code || !shop || !state) {
    return Response.json({ error: 'Missing params' }, { status: 400 })
  }

  const parts      = state.split('_')
  const businessId = parts[0]
  const returnTo   = parts[1] ?? 'integrations'   // 'onboarding' or 'integrations'
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

    // Auto-register orders/create webhook
    try {
      const webhookUrl = `${process.env.NEXTAUTH_URL}/api/shopify/webhook`
      await registerWebhook(shop, access_token, webhookUrl)
    } catch (e) {
      console.error('Webhook registration failed (non-fatal):', e)
    }

    // Kick off background: fetch products → AI setup → sync all history
    // Fire-and-forget (don't await — redirect happens immediately)
    triggerFullSetup(businessId, shop, access_token).catch(e =>
      console.error('Full setup failed (non-fatal):', e)
    )
  } catch (error) {
    console.error('Shopify OAuth error:', error)
    redirect(`/integrations?error=shopify&business=${businessId}`)
  }

  const dest = returnTo === 'onboarding'
    ? `/onboarding?shopify=connected&business=${businessId}`
    : `/integrations?connected=shopify&business=${businessId}`
  redirect(dest)
}
