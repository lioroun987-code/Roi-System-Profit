import Anthropic from '@anthropic-ai/sdk'
import { BusinessConfig, ShopifyOrder, AIOrderAnalysis } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Using Haiku 4.5 — 6x cheaper than Sonnet, fast enough for order analysis
const MODEL = 'claude-haiku-4-5-20251001'

export async function analyzeOrder(
  order: ShopifyOrder,
  config: BusinessConfig
): Promise<AIOrderAnalysis> {
  const { productCosts: pc, discountRules: dr, paymentSettings: ps, aiNotes } = config

  // Static system prompt — cached by Anthropic (pays once per 5 min window)
  const cachedSystemPrompt = `You are an e-commerce profitability calculator. Analyze Shopify orders and return exact profit calculations as JSON.

## BUSINESS PRODUCT COSTS
- Deal (בקבוק + 7 קפסולות): $${pc.dealCost} USD
- Cool Deal (שומר קור): $${pc.coolDealCost} USD
- Bottle only: $${pc.bottleCost} USD
- Single capsule: $${pc.singleCapsuleCost} USD
- 3-capsule pack store price: ₪${pc.pack3Price} ILS
- 7-capsule pack store price: ₪${pc.pack7Price} ILS
- Discount on 2nd+ unit: $${pc.secondUnitDiscount} USD per additional unit (2 units = 1 discount, 3 units = 2 discounts)
- Home delivery cost to business: $${pc.homeDeliveryCostUsd} USD
- Home delivery charge to customer: ₪${pc.homeDeliveryChargeIls} ILS
- Pickup fee: if order subtotal < ₪${pc.pickupFeeThresholdIls}, add ₪${pc.pickupFeeAmountIls} to customer price
- Exchange rate: $1 USD = ₪${pc.exchangeRate} ILS

## DISCOUNT RULES
- Quantity discount: 2 same-type DEALS = ${dr.qty2Percent}% off deals, 3 same-type DEALS = ${dr.qty3Percent}% off deals
- IMPORTANT: Quantity discount applies ONLY to deals (דיל/Cool Deal), NEVER to bottles or capsules
- Section 10% discount: overrides quantity discount, applies to everything
- Section 15% discount: overrides quantity discount, applies to everything
- 10%/15% section discounts NEVER stack with each other or with quantity discounts
- 50 ILS coupon STACKS with quantity discount (both apply)
- Surprise capsules (tagged __upcartRewardProduct or price=₪0 with original price>0 AND name contains "הפתעה"): cost $${dr.surpriseCapsuleCostUsd} each to business, ₪0 to customer
- Gift capsules (free when order > ₪${dr.giftCapsuleThresholdIls}): cost $${dr.giftCapsuleCostUsd} each to business, ₪0 to customer
- When gift name contains "הפתעה" AND price is ₪0.00: always treat as surprise/gift capsules

## PAYMENT & VAT
${ps.vatEnabled ? `- VAT: ${ps.vatPercent}% (already included in prices)` : '- No VAT'}
- Payment methods: ${ps.paymentMethods.filter(m => m.enabled).map(m => `${m.name}: ${m.feePercent}%`).join(', ')}

## PARSING RULES
1. "דיל (בקבוק + 7 קפסולות)" = one deal. The parentheses are just a description.
2. Main units for 2nd-unit discount = deals + cool deals + bottles. Capsule packs never count.
3. Second-unit discount = (total main units - 1) × $${pc.secondUnitDiscount} USD
4. For identifying gifts: check if item price is ₪0, original/compare_at_price > 0, and name contains "הפתעה" or tagged as bundle gift
5. Shipping: if order has home delivery, customer pays ₪${pc.homeDeliveryChargeIls}, business pays $${pc.homeDeliveryCostUsd}
6. Pickup fee: if order subtotal (before shipping) < ₪${pc.pickupFeeThresholdIls}, add ₪${pc.pickupFeeAmountIls} to customer total

## OWNER'S SPECIAL NOTES
${aiNotes || 'No special notes provided.'}

## RESPONSE FORMAT
Return ONLY valid JSON:
{
  "order_summary": "Hebrew one-line summary",
  "line_items_parsed": [{"name":"","quantity":1,"unitPriceIls":0,"totalPriceIls":0,"unitCostUsd":0,"totalCostUsd":0,"isGift":false,"isSurprise":false,"type":"deal|coolDeal|bottle|capsule|other"}],
  "discounts_applied": [{"name":"","amount_ils":0,"type":"quantity|section|coupon|gift"}],
  "store_price_breakdown": {"items":[{"name":"","amount":0}],"subtotal":0,"shipping_customer":0,"pickup_fee":0,"total":0},
  "my_cost_breakdown": {"items":[{"name":"","amount_usd":0}],"shipping_cost":0,"gift_capsule_cost":0,"total_usd":0},
  "my_cost_ils":0,"gross_profit_ils":0,"payment_fee_ils":0,"vat_ils":0,"net_profit_ils":0,"net_profit_usd":0,
  "exchange_rate_used":${pc.exchangeRate},"payment_method":"","notes":""
}`

  const orderJson = JSON.stringify(order)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: cachedSystemPrompt,
        cache_control: { type: 'ephemeral' }, // Cache system prompt — paid once per 5 min
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Analyze this Shopify order and return profitability JSON:\n${orderJson}`,
      },
    ],
  } as any)

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  const text = content.text.trim()
  const jsonMatch = text.match(/```json\n?([\s\S]+?)\n?```/) || text.match(/(\{[\s\S]+\})/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]) as AIOrderAnalysis
  return parsed
}
