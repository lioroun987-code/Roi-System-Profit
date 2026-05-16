import { ShopifyOrder, ShopifyLineItem, BusinessConfig, AIOrderAnalysis, AIParsedItem } from '@/types'

/* ─── Helpers ─── */

function isGiftItem(item: ShopifyLineItem): boolean {
  const price      = parseFloat(item.price)
  const compareAt  = item.compare_at_price ? parseFloat(item.compare_at_price) : 0
  const hasSurprise = item.title?.includes('הפתעה') || item.name?.includes('הפתעה')
  const isReward    = item.properties?.some(
    p => p.name === '_upcartRewardProduct' || p.name === '__upcartRewardProduct'
  )
  return price === 0 && (compareAt > 0 || isReward || hasSurprise)
}

// Items added by bundle apps (kaching, etc.) as part of a deal —
// cost is already included in the main deal item, so $0 additional cost
function isBundleIncluded(item: ShopifyLineItem): boolean {
  if (item.properties?.some(p =>
    p.name === '___kaching_bundles' ||
    p.name === '__kaching_bundles'  ||
    p.name?.toLowerCase().includes('_bundle')
  )) return true

  // Capsule packs (סט קפסולות) with 100% discount — display item included in deal price
  const price         = parseFloat(item.price)
  const totalDiscount = parseFloat((item as any).total_discount ?? '0')
  const isCapsulePack = price > 0 && (
    item.title?.includes('קפסולות') ||
    item.title?.toLowerCase().includes('capsule')
  )
  const isFullyDiscounted = totalDiscount >= price * item.quantity - 0.01
  return isCapsulePack && isFullyDiscounted
}

function getProductType(title: string): AIParsedItem['type'] {
  const t = (title ?? '').toLowerCase()
  if (t.includes('cool') || t.includes('שומר קור'))             return 'coolDeal'
  if (t.includes('דיל') || t.includes('deal'))                  return 'deal'
  if (t.includes('בקבוק') || t.includes('bottle'))              return 'bottle'
  if (t.includes('קפסול') || t.includes('capsule') || t.includes('כדורי')) return 'capsule'
  return 'other'
}

function detectPaymentMethod(
  order: ShopifyOrder,
  methods: Array<{ name: string; feePercent: number; enabled: boolean }>,
  flatFeeMode?: boolean,
  averageFeePercent?: number
): { name: string; feePercent: number } {
  if (flatFeeMode && averageFeePercent != null) {
    return { name: 'עמלה ממוצעת', feePercent: averageFeePercent }
  }
  const gw   = (order.gateway ?? '').toLowerCase()
  const names = (order.payment_gateway_names ?? []).map(n => n.toLowerCase())
  const all   = [gw, ...names].join(' ')

  const find = (keyword: string) =>
    methods.find(m => m.enabled && m.name.toLowerCase().includes(keyword))

  if (all.includes('bit') || all.includes('pay_me') || all.includes('payme'))
    return find('bit') ?? { name: 'Bit', feePercent: 3 }

  if (all.includes('apple'))
    return find('apple') ?? { name: 'Apple Pay', feePercent: 1.5 }

  if (all.includes('google'))
    return find('google') ?? { name: 'Google Pay', feePercent: 1.5 }

  if (all.includes('paypal'))
    return find('paypal') ?? { name: 'PayPal', feePercent: 4.5 }

  if (gw === 'manual' || gw === 'cash_on_delivery' || all.includes('מזומן'))
    return { name: 'מזומן', feePercent: 0 }

  // External Israeli gateways → credit card
  if (['cardcom','tranzila','icredit','grow','neodeal','hyp','meshulam','nuvei'].some(g => all.includes(g)))
    return find('אשראי') ?? find('credit') ?? { name: 'כרטיס אשראי', feePercent: 1.5 }

  return find('אשראי') ?? find('credit') ?? { name: 'כרטיס אשראי', feePercent: 1.5 }
}

function detectHomeDelivery(order: ShopifyOrder): boolean {
  if (!order.shipping_lines?.length) return false
  return order.shipping_lines.some(s => {
    const t = (s.title ?? '').toLowerCase()
    const p = parseFloat(s.price ?? '0')
    return t.includes('בית') || t.includes('home') || t.includes('deliver') || p > 0
  })
}

/* ─── Main calculator ───────────────────────────────────────────
   Returns null when it can't calculate deterministically
   (e.g. product not found in catalog) — caller falls back to AI
──────────────────────────────────────────────────────────────── */
export function calculateOrderCost(
  order: ShopifyOrder,
  config: BusinessConfig
): AIOrderAnalysis | null {
  const { productCosts: pc, discountRules: dr, paymentSettings: ps } = config
  const exchangeRate  = (pc as any).exchangeRate ?? 3.7
  const customCosts   = (pc as any).customProductCosts as Record<string, {
    productId: string; variantId: string; productTitle: string
    variantTitle: string; costUsd: number; sellingPriceIls: number
  }> | undefined

  if (!customCosts || Object.keys(customCosts).length === 0) return null

  /* ── 1. Parse line items ── */
  const parsedItems: AIParsedItem[] = []

  for (const item of order.line_items) {
    if (isGiftItem(item)) {
      // Bundle-included items (added by kaching/bundle apps) have $0 cost —
      // the cost is already part of the main deal item
      const bundled     = isBundleIncluded(item)
      const giftCostUsd = bundled
        ? 0
        : ((dr as any)?.surpriseCapsuleCostUsd ?? (dr as any)?.giftCapsuleCostUsd ?? 0.85)

      parsedItems.push({
        name:           item.title,
        quantity:       item.quantity,
        unitPriceIls:   0,
        totalPriceIls:  0,
        unitCostUsd:    giftCostUsd,
        totalCostUsd:   giftCostUsd * item.quantity,
        isGift:         true,
        isSurprise:     item.title?.includes('הפתעה') ?? false,
        type:           'capsule',
      })
      continue
    }

    // Look up by product_id_variant_id (exact Shopify IDs)
    const key = `${item.product_id}_${item.variant_id}`
    const entry = customCosts[key]

    if (!entry) return null   // Unknown product → fall back to AI

    parsedItems.push({
      name:           item.title,
      quantity:       item.quantity,
      unitPriceIls:   parseFloat(item.price),
      totalPriceIls:  parseFloat(item.price) * item.quantity,
      unitCostUsd:    entry.costUsd,
      totalCostUsd:   entry.costUsd * item.quantity,
      isGift:         false,
      isSurprise:     false,
      type:           getProductType(item.title),
    })
  }

  /* ── 2. Second-unit cost discount ── */
  const mainUnitCount = parsedItems
    .filter(i => !i.isGift && (i.type === 'deal' || i.type === 'coolDeal' || i.type === 'bottle'))
    .reduce((s, i) => s + i.quantity, 0)
  const secondUnitDiscountUsd = mainUnitCount > 1
    ? (mainUnitCount - 1) * ((pc as any).secondUnitDiscount ?? 2)
    : 0

  /* ── 3. Customer price (use Shopify ground truth) ── */
  const subtotalBeforeDiscounts = parsedItems.reduce((s, i) => s + i.totalPriceIls, 0)
  const totalDiscountsIls       = parseFloat(order.total_discounts ?? '0')
  const homeDelivery            = detectHomeDelivery(order)
  const shippingCustomerIls     = order.shipping_lines
    ?.reduce((s, l) => s + parseFloat(l.discounted_price ?? l.price ?? '0'), 0) ?? 0

  // Pickup fee: if no home delivery and subtotal < threshold
  const pickupThreshold = (pc as any).pickupFeeThresholdIls ?? 200
  const pickupFeeAmt    = (pc as any).pickupFeeAmountIls    ?? 10
  const subtotalAfterDiscount = subtotalBeforeDiscounts - totalDiscountsIls
  const pickupFee = !homeDelivery && subtotalAfterDiscount < pickupThreshold ? pickupFeeAmt : 0

  // Use Shopify's total_price as the authoritative customer payment
  const totalCustomerPrice = parseFloat(order.total_price)

  /* ── 4. Detect discount types (for labeling) ── */
  const discountsApplied: AIOrderAnalysis['discounts_applied'] = []

  for (const da of order.discount_applications ?? []) {
    const value = parseFloat(da.value ?? '0')
    if (da.value_type === 'percentage') {
      discountsApplied.push({
        name:       `${value}% הנחה`,
        amount_ils: (subtotalBeforeDiscounts * value) / 100,
        type:       'section',
      })
    } else if (da.value_type === 'fixed_amount' && value >= 40) {
      discountsApplied.push({
        name:       `קופון ₪${value}`,
        amount_ils: value,
        type:       'coupon',
      })
    }
  }

  /* ── 5. My cost ── */
  const itemsCostUsd   = parsedItems.filter(i => !i.isGift).reduce((s, i) => s + i.totalCostUsd, 0)
  const giftCostUsd    = parsedItems.filter(i => i.isGift).reduce((s, i) => s + i.totalCostUsd, 0)
  const shippingCostUsd = homeDelivery ? ((pc as any).homeDeliveryCostUsd ?? 3) : 0
  const totalCostUsd   = itemsCostUsd - secondUnitDiscountUsd + shippingCostUsd + giftCostUsd
  const totalCostIls   = totalCostUsd * exchangeRate

  /* ── 6. Payment fee ── */
  const paymentMethod  = detectPaymentMethod(
    order,
    ps?.paymentMethods ?? [],
    (ps as any)?.flatFeeMode,
    (ps as any)?.averageFeePercent
  )
  const paymentFeeIls  = (totalCustomerPrice * paymentMethod.feePercent) / 100

  /* ── 7. VAT ── */
  const vatIls = ps?.vatEnabled
    ? (totalCustomerPrice * (ps.vatPercent ?? 17)) / 100
    : 0

  /* ── 8. Profit ── */
  const grossProfitIls = totalCustomerPrice - totalCostIls
  const netProfitIls   = grossProfitIls - paymentFeeIls - vatIls
  const netProfitUsd   = netProfitIls / exchangeRate

  /* ── Summary ── */
  const productSummary = parsedItems
    .filter(i => !i.isGift)
    .map(i => `${i.quantity}× ${i.name}`)
    .join(', ')
  const notes = secondUnitDiscountUsd > 0
    ? `הנחת יחידה 2+: $${secondUnitDiscountUsd.toFixed(2)}`
    : ''

  return {
    order_summary: `${productSummary}${homeDelivery ? ' | משלוח לבית' : ' | איסוף עצמי'}`,
    line_items_parsed: parsedItems,
    discounts_applied: discountsApplied,
    store_price_breakdown: {
      items:             parsedItems.map(i => ({ name: i.name, amount: i.totalPriceIls })),
      subtotal:          subtotalBeforeDiscounts,
      shipping_customer: shippingCustomerIls,
      pickup_fee:        pickupFee,
      total:             totalCustomerPrice,
    },
    my_cost_breakdown: {
      items:         parsedItems.filter(i => !i.isGift).map(i => ({ name: i.name, amount_usd: i.totalCostUsd })),
      shipping_cost: shippingCostUsd,
      gift_capsule_cost: giftCostUsd,
      total_usd:     totalCostUsd,
    },
    my_cost_ils:       totalCostIls,
    gross_profit_ils:  grossProfitIls,
    payment_fee_ils:   paymentFeeIls,
    vat_ils:           vatIls,
    net_profit_ils:    netProfitIls,
    net_profit_usd:    netProfitUsd,
    exchange_rate_used: exchangeRate,
    payment_method:    paymentMethod.name,
    notes,
  }
}
