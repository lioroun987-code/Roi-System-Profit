import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

// Lazy — constructing at module load throws when ANTHROPIC_API_KEY is unset,
// breaking the route at import time instead of returning a clean error.
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))
}

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

## ROUTING DECISION — read carefully before acting

### 1. PRICE CHANGE → productCosts
- "עלות X עלתה ל-$Y" → costUsd
- "שער חליפין X" → exchangeRate
- "הנחת יחידה שנייה $X" → secondUnitDiscount
- "עלות משלוח $X" → homeDeliveryCostUsd

### 2. CONDITIONAL RULE → discountRules.costRules
Use ONLY when the cost depends on a CONDITION (quantity, order content, customer got item free).
- "כשקונים N+ מסוג X, הסוכן מוריד $Y" → costRule
- "כשהלקוח מקבל מוצר X בחינם, העלות שלי $0" → costRule (customer_price_is_zero)
- "אם יש X בהזמנה, Y עולה $Z" → costRule

### 3. FEE → paymentSettings
- "עמלת סליקה X%" → flatFeeMode + averageFeePercent

### 4. aiNotes → LAST RESORT ONLY
Use aiNotes ONLY for genuine edge cases with no structured field.
NEVER write debug notes, explanations, or problem descriptions in aiNotes.
aiNotes is ONLY for real business instructions the AI needs to follow every time.

## CRITICAL DISTINCTION: catalog $0 vs cost rule $0

WRONG approach: setting costUsd=0 in catalog for a product the business actually pays for.
→ This makes ALL orders with that product show $0 cost, even when customer PAID for it.

CORRECT approach:
- Product has a REAL cost from supplier → set costUsd = real price in catalog
- When customer gets it FREE as gift → add costRule: customer_price_is_zero → set_cost=0
- The costRule only applies when customer paid $0; catalog cost applies when customer paid > $0

EXAMPLE (capsule set that costs $5.95 but sometimes given as gift):
- Catalog: costUsd = 5.95 (always the real supplier cost)
- costRule: condition=customer_price_is_zero, productKey="סט 7 קפסולות" → effect=set_cost_per_unit=0
→ Result: customer paid for it = $5.95 cost ✓ | customer got it free = $0 cost ✓

NEVER set catalog costUsd=0 unless the supplier literally gives it for free every time.

## RESPONSE FORMAT
Reply in 1-2 short Hebrew sentences. Always return JSON:
{
  "reply": "עדכנתי X מ-Y ל-Z",
  "patches": [
    { "section": "productCosts|discountRules|paymentSettings|aiNotes", "path": "field.subfield", "value": <new value> }
  ]
}

PATCH EXAMPLES:
- Product cost: { "section": "productCosts", "path": "customProductCosts.{key}.costUsd", "value": 9.0 }
- Shipping: { "section": "productCosts", "path": "homeDeliveryCostUsd", "value": 3.5 }
- Exchange rate: { "section": "productCosts", "path": "exchangeRate", "value": 3.65 }
- Payment fee: { "section": "paymentSettings", "path": "flatFeeMode", "value": true }
- AI notes: { "section": "aiNotes", "path": "", "value": "הנחיה אמיתית בלבד — לא debugging" }

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

CONDITION TYPES:
- quantity_of_type: N or more units of a product type (deal/bottle/capsule/any)
- quantity_same_product: N or more of the same product
- total_items: total item count
- product_in_order: a specific product type/key is present anywhere in the order
- customer_price_is_zero: a specific product type was given FREE to the customer (0 price, display item)

EXAMPLE RULES:
- "סוכן מוריד $3.60 לכל דיל נוסף מאותו סוג":
  condition: {type:"quantity_of_type", productType:"bottle", operator:">=", value:2}
  effect: {type:"reduce_cost_per_unit", appliesTo:"matching_items", productType:"bottle", value:3.60}

- "סט 7 קפסולות שניתן חינם ללקוח (display item) → עלות $0 לעסק":
  condition: {type:"customer_price_is_zero", productType:"capsule"}
  effect: {type:"set_cost_per_unit", appliesTo:"matching_items", productKey:"סט 7 קפסולות", value:0}
  NOTE: use productKey (name match) NOT productType:"capsule" — to avoid affecting other capsule gifts like "3 קפסולות הפתעה"

- "כשקונים 3+ בקבוקים, עלות כל בקבוק $14":
  condition: {type:"quantity_of_type", productType:"bottle", operator:">=", value:3}
  effect: {type:"set_cost_per_unit", appliesTo:"matching_items", productType:"bottle", value:14}

Return ONLY the JSON — no text before or after.`

    const messages: any[] = [
      ...history.slice(-6).map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const response = await getClient().messages.create({
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
