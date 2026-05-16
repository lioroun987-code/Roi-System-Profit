import Anthropic from '@anthropic-ai/sdk'
import { BusinessConfig, ShopifyOrder, AIOrderAnalysis } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-haiku-4-5-20251001'

export async function analyzeOrder(
  order: ShopifyOrder,
  config: BusinessConfig
): Promise<AIOrderAnalysis> {
  const { productCosts: pc, discountRules: dr, paymentSettings: ps, aiNotes } = config
  const exchangeRate = (pc as any).exchangeRate ?? 3.7

  // Build product catalog from user's Shopify-synced products
  const customProducts = (pc as any).customProductCosts as Record<string, {
    productTitle: string; variantTitle: string; costUsd: number; sellingPriceIls: number
  }> | undefined

  const catalogSection = customProducts && Object.keys(customProducts).length > 0
    ? `## PRODUCT CATALOG (use these costs — match by name)
${Object.values(customProducts)
  .filter(p => p.costUsd >= 0)
  .map(p => `- "${p.productTitle}"${p.variantTitle && p.variantTitle !== 'Default Title' ? ` / "${p.variantTitle}"` : ''}: costs $${p.costUsd} → ₪${(p.costUsd * exchangeRate).toFixed(2)} | sells ₪${p.sellingPriceIls}${p.costUsd === 0 ? ' [DISPLAY ITEM — $0 cost to business]' : ''}`)
  .join('\n')}

Items with $0 catalog cost = display/bundle items included in the deal — do NOT charge them.
If an item is NOT in the catalog, use the fallback rules below.

`
    : ''

  // Cost rules from user config
  const costRules: any[] = (dr as any)?.costRules ?? []
  const activeCostRules = costRules.filter(r => r.active)
  const costRulesSection = activeCostRules.length > 0
    ? `## COST RULES (apply after catalog costs)
${activeCostRules.map(r => `- ${r.name}: ${r.note || JSON.stringify({ condition: r.condition, effect: r.effect })}`).join('\n')}

`
    : ''

  const cachedSystemPrompt = `You are an e-commerce profitability calculator. Analyze Shopify orders and return exact profit as JSON.

${catalogSection}${costRulesSection}## SHIPPING & FEES
- Second-unit discount: $${(pc as any).secondUnitDiscount ?? 2} USD per extra unit of the SAME product type (not cross-type)
- Home delivery cost to business: $${(pc as any).homeDeliveryCostUsd ?? 3} USD
- Home delivery charge to customer: ₪${(pc as any).homeDeliveryChargeIls ?? 25} ILS
- Pickup fee threshold: if subtotal < ₪${(pc as any).pickupFeeThresholdIls ?? 200} → add ₪${(pc as any).pickupFeeAmountIls ?? 10}
- Exchange rate: $1 = ₪${exchangeRate}

## PAYMENT & VAT
${ps.vatEnabled
  ? `- VAT: ${ps.vatPercent}% INCLUDED in price. Extract as: price × ${ps.vatPercent}/${100 + ps.vatPercent} (NOT price × ${ps.vatPercent}%)`
  : '- No VAT'}
${(ps as any).flatFeeMode
  ? `- Flat fee: ${(ps as any).averageFeePercent}% on every order`
  : `- Methods: ${(ps.paymentMethods ?? []).filter((m: any) => m.enabled).map((m: any) => `${m.name} ${m.feePercent}%`).join(', ')}`}

## PAYMENT DETECTION
gateway/payment_gateway_names: bit/pay_me → Bit | shopify_payments+apple → Apple Pay | shopify_payments+google → Google Pay | shopify_payments → Credit Card | paypal → PayPal | cardcom/tranzila/hyp/meshulam → Credit Card | manual/cash → Cash

## GIFT ITEMS
- price=₪0 AND compare_at_price>0 AND tagged _upcartRewardProduct → gift, use surpriseCost=$${(dr as any)?.surpriseCapsuleCostUsd ?? 0.85}
- Items in catalog with $0 cost → display items, $0 cost to business

## OWNER NOTES
${aiNotes || 'None.'}

## RESPONSE (JSON only)
{
  "order_summary": "Hebrew one-line",
  "line_items_parsed": [{"name":"","quantity":1,"unitPriceIls":0,"totalPriceIls":0,"unitCostUsd":0,"totalCostUsd":0,"isGift":false,"isSurprise":false,"type":"deal|coolDeal|bottle|capsule|other"}],
  "discounts_applied": [{"name":"","amount_ils":0,"type":"quantity|section|coupon|gift"}],
  "store_price_breakdown": {"items":[{"name":"","amount":0}],"subtotal":0,"shipping_customer":0,"pickup_fee":0,"total":0},
  "my_cost_breakdown": {"items":[{"name":"","amount_usd":0}],"shipping_cost":0,"gift_capsule_cost":0,"total_usd":0},
  "my_cost_ils":0,"gross_profit_ils":0,"payment_fee_ils":0,"vat_ils":0,"net_profit_ils":0,"net_profit_usd":0,
  "exchange_rate_used":${exchangeRate},"payment_method":"","notes":""
}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: 'text', text: cachedSystemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Analyze this Shopify order:\n${JSON.stringify(order)}` }],
  } as any)

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  const text = content.text.trim()
  const jsonMatch = text.match(/```json\n?([\s\S]+?)\n?```/) || text.match(/(\{[\s\S]+\})/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')

  return JSON.parse(jsonMatch[1] || jsonMatch[0]) as AIOrderAnalysis
}
