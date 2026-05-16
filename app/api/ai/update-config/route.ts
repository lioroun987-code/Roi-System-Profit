import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function extractJson(text: string): any | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (esc)            { esc = false; continue }
    if (c === '\\' && inStr) { esc = true; continue }
    if (c === '"')      { inStr = !inStr; continue }
    if (inStr)          continue
    if (c === '{')      depth++
    if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)) } catch { return null } } }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const { businessId, message, history = [] } = await request.json()

    const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
    if (!business) return Response.json({ error: 'Not found' }, { status: 404 })

    const pc = business.productCosts as any ?? {}
    const dr = business.discountRules as any ?? {}
    const ps = business.paymentSettings as any ?? {}

    const products = Object.entries(pc.customProductCosts ?? {}).map(([key, v]: [string, any]) =>
      `  "${key}": { productTitle: "${v.productTitle}", variantTitle: "${v.variantTitle}", costUsd: ${v.costUsd}, sellingPriceIls: ${v.sellingPriceIls} }`
    ).join('\n')

    const systemPrompt = `You are a smart business configuration assistant for an e-commerce profitability system. You speak Hebrew.

CURRENT CONFIGURATION:
Product costs (customProductCosts):
${products || '  (empty)'}

Shipping: homeDeliveryCostUsd=${pc.homeDeliveryCostUsd}, homeDeliveryChargeIls=${pc.homeDeliveryChargeIls}, pickupFeeThresholdIls=${pc.pickupFeeThresholdIls}, pickupFeeAmountIls=${pc.pickupFeeAmountIls}
Exchange rate: ${pc.exchangeRate}
Second unit discount: $${pc.secondUnitDiscount}

Discount rules: qty2=${dr.qty2Percent}%, qty3=${dr.qty3Percent}%, surpriseCapsuleCost=$${dr.surpriseCapsuleCostUsd}, giftThreshold=₪${dr.giftCapsuleThresholdIls}, giftCost=$${dr.giftCapsuleCostUsd}

Payment: ${(ps as any).flatFeeMode ? `flat ${(ps as any).averageFeePercent}%` : (ps.paymentMethods ?? []).filter((m: any) => m.enabled).map((m: any) => `${m.name}=${m.feePercent}%`).join(', ')}

AI notes: ${business.aiNotes || '(none)'}

Your job:
1. Understand the user's request in Hebrew
2. Make the appropriate changes to the configuration
3. Return a JSON response with the changes and a Hebrew confirmation message

Rules:
- Match product names fuzzily (e.g. "דיל" matches productTitle containing "דיל")
- Changes to product cost → update customProductCosts[key].costUsd
- Changes to selling price → update customProductCosts[key].sellingPriceIls
- Changes to shipping → update shipping fields
- Changes to discount rules → update discountRules fields
- Changes to payment fees → update paymentMethods or flatFeeMode
- Changes to AI notes → append or replace aiNotes
- If nothing needs changing → explain why

Return ONLY this JSON (no extra text):
{
  "reply": "הודעה בעברית — מה שינית ולמה",
  "changes": {
    "what_changed": "תיאור קצר",
    "fields": ["רשימה של שדות שעודכנו"]
  },
  "updatedConfig": {
    "productCosts": { ...full updated productCosts... },
    "discountRules": { ...full updated discountRules... },
    "paymentSettings": { ...full updated paymentSettings... },
    "aiNotes": "..."
  }
}`

    const messages: any[] = [
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    })

    const raw = (response.content[0] as any).text?.trim() ?? ''
    const parsed = extractJson(raw)

    if (!parsed) {
      return Response.json({ reply: raw, changes: null, updatedConfig: null })
    }

    // Apply changes to DB if updatedConfig is present
    if (parsed.updatedConfig) {
      const patch: any = {}
      if (parsed.updatedConfig.productCosts)    patch.productCosts    = parsed.updatedConfig.productCosts
      if (parsed.updatedConfig.discountRules)   patch.discountRules   = parsed.updatedConfig.discountRules
      if (parsed.updatedConfig.paymentSettings) patch.paymentSettings = parsed.updatedConfig.paymentSettings
      if (parsed.updatedConfig.aiNotes != null) patch.aiNotes         = parsed.updatedConfig.aiNotes

      if (Object.keys(patch).length > 0) {
        await prisma.business.update({ where: { id: businessId }, data: patch })
      }
    }

    return Response.json({
      reply:         parsed.reply ?? raw,
      changes:       parsed.changes ?? null,
      updatedConfig: parsed.updatedConfig ?? null,
    })

  } catch (e: any) {
    console.error('update-config error:', e)
    return Response.json({ error: e?.message ?? 'שגיאה' }, { status: 500 })
  }
}
