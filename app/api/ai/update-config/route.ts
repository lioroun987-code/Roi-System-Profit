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
    if (esc)             { esc = false; continue }
    if (c === '\\' && inStr) { esc = true; continue }
    if (c === '"')       { inStr = !inStr; continue }
    if (inStr)           continue
    if (c === '{')       depth++
    if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)) } catch { return null } } }
  }
  return null
}

// Deep-set a nested value by dot-path, e.g. "customProductCosts.key.costUsd"
function deepSet(obj: any, path: string, value: any): any {
  const keys = path.split('.')
  const result = { ...obj }
  let cur = result
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] ?? {}) }
    cur = cur[keys[i]]
  }
  cur[keys[keys.length - 1]] = value
  return result
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
    const dr = business.discountRules  as any ?? {}
    const ps = business.paymentSettings as any ?? {}

    // Build compact config summary for context
    const productLines = Object.entries(pc.customProductCosts ?? {})
      .map(([key, v]: [string, any]) =>
        `  key="${key}" | ${v.productTitle}${v.variantTitle !== 'Default Title' ? `/${v.variantTitle}` : ''} | costUsd=${v.costUsd} | sellIls=${v.sellingPriceIls}`
      ).join('\n')

    const systemPrompt = `You are a config assistant for a Hebrew e-commerce profit tracker. Answer in Hebrew only.

CURRENT CONFIG:
Products:
${productLines || '  (none)'}
Shipping: homeDeliveryCostUsd=${pc.homeDeliveryCostUsd}, homeDeliveryChargeIls=${pc.homeDeliveryChargeIls}, pickupFeeThresholdIls=${pc.pickupFeeThresholdIls}, pickupFeeAmountIls=${pc.pickupFeeAmountIls}
ExchangeRate: ${pc.exchangeRate} | secondUnitDiscount: $${pc.secondUnitDiscount}
Discounts: qty2=${dr.qty2Percent}%, qty3=${dr.qty3Percent}%, surpriseCost=$${dr.surpriseCapsuleCostUsd}, giftThreshold=₪${dr.giftCapsuleThresholdIls}
Payment: ${(ps as any).flatFeeMode ? `flat ${(ps as any).averageFeePercent}%` : (ps.paymentMethods ?? []).filter((m: any) => m.enabled).map((m: any) => `${m.name}=${m.feePercent}%`).join(', ')}
AI notes: ${business.aiNotes || '(none)'}

ROUTING DECISION — before doing anything, decide:
  IS THIS A PRICE CHANGE? → update productCosts (costUsd / selling price / shipping / exchange rate)
  IS THIS A RULE? → add/update discountRules.costRules (condition-based supplier discounts)
  IS THIS A FEE? → update paymentSettings
  IS THIS AN EDGE CASE? → aiNotes (only if no structured field exists)

HOW TO TELL:
- "עלות X עלתה ל-$Y" → PRICE CHANGE (productCosts)
- "כשקונים N מוצרים מאותו סוג, הסוכן מוריד $Z" → RULE (costRules)
- "הנחת יחידה שנייה היא $X" → PRICE CHANGE (productCosts.secondUnitDiscount)
- "עמלת Bit X%" → FEE (paymentSettings)
- Complex business logic with no field → aiNotes

RULES:
- Reply in 1-2 short Hebrew sentences only — state exactly what you changed.
- If nothing to change, say so in one sentence.
- CRITICAL: Always update the actual config field. aiNotes is ONLY for edge cases.
- Always return a JSON object with this exact structure:

{
  "reply": "עדכנתי X מ-Y ל-Z",
  "patches": [
    { "section": "productCosts|discountRules|paymentSettings|aiNotes", "path": "field.subfield", "value": <new value> }
  ]
}

PATCH EXAMPLES:
- Change product cost: { "section": "productCosts", "path": "customProductCosts.{exact key}.costUsd", "value": 9.0 }
- Change shipping: { "section": "productCosts", "path": "homeDeliveryCostUsd", "value": 3.5 }
- Change exchange rate: { "section": "productCosts", "path": "exchangeRate", "value": 3.65 }
- Change discount: { "section": "discountRules", "path": "qty2Percent", "value": 12 }
- Change payment fee: { "section": "paymentSettings", "path": "paymentMethods.0.feePercent", "value": 2.5 }  (use array index)
- Flat fee mode: { "section": "paymentSettings", "path": "flatFeeMode", "value": true }
- AI notes (only for edge cases with no config field): { "section": "aiNotes", "path": "", "value": "new notes text" }

EXAMPLES of what goes WHERE:
- "קפסולה עולה $0.90" → patch discountRules.surpriseCapsuleCostUsd = 0.90
- "עלות דיל $9" → patch productCosts.customProductCosts.{key}.costUsd = 9.0
- "עמלת bit 2.5%" → patch paymentSettings.paymentMethods.{index}.feePercent = 2.5
- "כשקונים 2 בקבוקים עלות כל בקבוק יורדת ב-$1.80" → add cost rule (see below)
- "כשיש קופון ספציפי X, תתייחס אחרת" → THIS goes to aiNotes (no config field for it)

COST RULES — for complex supplier pricing:
Use type "costRules" to add/update/remove rules in discountRules.costRules array.
Patch: { "section": "discountRules", "path": "costRules", "value": [...existing rules..., newRule] }

Rule schema:
{
  "id": "cr_<unique>",
  "name": "שם בעברית",
  "active": true,
  "condition": {
    "type": "quantity_of_type" | "quantity_same_product" | "total_items" | "product_in_order",
    "productType": "deal" | "coolDeal" | "bottle" | "capsule" | "any",
    "operator": ">=" | ">" | "==" | "<=",
    "value": <number>
  },
  "effect": {
    "type": "reduce_cost_per_unit" | "set_cost_per_unit" | "percent_off_total",
    "appliesTo": "matching_items" | "all_items",
    "productType": "deal" | "coolDeal" | "bottle" | "any",
    "value": <number in USD or percent>
  },
  "note": "הסבר לכלל"
}

EXAMPLE RULES:
- "סוכן מוריד $1.80 לכל דיל כשקונים 2+":
  condition: {type:"quantity_of_type", productType:"deal", operator:">=", value:2}
  effect: {type:"reduce_cost_per_unit", appliesTo:"matching_items", productType:"deal", value:1.80}

- "כשקונים 3+ בקבוקים, עלות כל בקבוק $14":
  condition: {type:"quantity_of_type", productType:"bottle", operator:">=", value:3}
  effect: {type:"set_cost_per_unit", appliesTo:"matching_items", productType:"bottle", value:14}

Return ONLY the JSON — no text before or after.`

    const messages: any[] = [
      ...history.slice(-6).map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',   // Haiku: faster + cheaper for simple config changes
      max_tokens: 512,
      system:     systemPrompt,
      messages,
    })

    const raw = (response.content[0] as any).text?.trim() ?? ''
    const parsed = extractJson(raw)

    if (!parsed?.patches) {
      // AI replied with no patches — just return the text
      const reply = parsed?.reply ?? raw
      return Response.json({ reply, changes: null })
    }

    // Apply patches to existing config
    let updatedPc = { ...pc }
    let updatedDr = { ...dr }
    let updatedPs = { ...ps }
    let updatedAiNotes = business.aiNotes ?? ''

    const applied: string[] = []

    for (const patch of parsed.patches as Array<{ section: string; path: string; value: any }>) {
      try {
        if (patch.section === 'productCosts') {
          updatedPc = deepSet(updatedPc, patch.path, patch.value)
          applied.push(patch.path)
        } else if (patch.section === 'discountRules') {
          updatedDr = deepSet(updatedDr, patch.path, patch.value)
          applied.push(patch.path)
        } else if (patch.section === 'paymentSettings') {
          if (patch.path.startsWith('paymentMethods.')) {
            // e.g. "paymentMethods.0.feePercent" → update by index
            const parts   = patch.path.split('.')
            const idx      = parseInt(parts[1])
            const field    = parts[2]
            const methods  = [...(updatedPs.paymentMethods ?? [])]
            if (methods[idx]) {
              methods[idx] = { ...methods[idx], [field]: patch.value }
              updatedPs = { ...updatedPs, paymentMethods: methods }
              applied.push(patch.path)
            } else {
              // Try to find by name if index doesn't match
              const name = patch.path  // fallback
              console.warn('paymentMethods index not found:', idx)
            }
          } else {
            updatedPs = deepSet(updatedPs, patch.path, patch.value)
            applied.push(patch.path)
          }
        } else if (patch.section === 'aiNotes') {
          updatedAiNotes = patch.value
          applied.push('aiNotes')
        }
      } catch (e) {
        console.error('Patch failed:', patch, e)
      }
    }

    let saved = false
    if (applied.length > 0) {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          productCosts:    updatedPc,
          discountRules:   updatedDr,
          paymentSettings: updatedPs,
          aiNotes:         updatedAiNotes,
        },
      })
      saved = true
      console.log(`[update-config] Saved ${applied.length} patches for business ${businessId}:`, applied)
    }

    return Response.json({
      reply:   parsed.reply ?? 'בוצע',
      saved,
      changes: applied.length > 0 ? { what_changed: applied.join(', '), fields: applied } : null,
    })

  } catch (e: any) {
    console.error('update-config error:', e)
    return Response.json({ error: e?.message ?? 'שגיאה' }, { status: 500 })
  }
}
