export interface CustomProductCost {
  productId: string
  variantId: string
  productTitle: string
  variantTitle: string
  costUsd: number
  sellingPriceIls: number
}

export interface ProductCosts {
  // Dynamic product costs pulled from Shopify
  customProductCosts?: Record<string, CustomProductCost>
  // Delivery & exchange rate
  homeDeliveryCostUsd: number
  homeDeliveryChargeIls: number
  pickupFeeThresholdIls: number
  pickupFeeAmountIls: number
  exchangeRate: number
  secondUnitDiscount: number
  // Legacy capsule-specific keys (kept for backward compat)
  dealCost?: number
  coolDealCost?: number
  bottleCost?: number
  singleCapsuleCost?: number
  pack3Price?: number
  pack7Price?: number
}

export interface DiscountRules {
  qty2Percent: number
  qty3Percent: number
  section10Percent: boolean
  section15Percent: boolean
  coupon50Ils: boolean
  surpriseCapsuleCostUsd: number
  giftCapsuleThresholdIls: number
  giftCapsuleCostUsd: number
}

export interface PaymentMethod {
  name: string
  feePercent: number
  enabled: boolean
}

export interface PaymentSettings {
  vatEnabled: boolean
  vatPercent: number
  paymentMethods: PaymentMethod[]
}

export interface BusinessConfig {
  productCosts: ProductCosts
  discountRules: DiscountRules
  paymentSettings: PaymentSettings
  aiNotes: string
}

export interface ShopifyLineItem {
  id: number
  title: string
  variant_title: string | null
  price: string
  quantity: number
  compare_at_price: string | null
  total_discount: string
  properties: Array<{ name: string; value: string }>
  product_id: number
  variant_id: number
  sku: string
  name: string
  vendor: string
  taxable: boolean
  gift_card: boolean
  price_set: { shop_money: { amount: string; currency_code: string } }
  total_discount_set: { shop_money: { amount: string; currency_code: string } }
}

export interface ShopifyOrder {
  id: number
  order_number: number
  name: string
  created_at: string
  updated_at: string
  line_items: ShopifyLineItem[]
  discount_codes: Array<{ code: string; amount: string; type: string }>
  discount_applications: Array<{
    type: string
    value: string
    value_type: string
    allocation_method: string
    target_selection: string
    target_type: string
    code?: string
    title?: string
  }>
  shipping_lines: Array<{
    title: string
    price: string
    discounted_price: string
    code: string
  }>
  total_price: string
  subtotal_price: string
  total_discounts: string
  total_tax: string
  currency: string
  financial_status: string
  fulfillment_status: string | null
  customer: {
    first_name: string
    last_name: string
    email: string
  } | null
  billing_address: Record<string, string> | null
  shipping_address: Record<string, string> | null
  payment_gateway_names: string[]
  gateway: string
  note: string | null
  tags: string
  metafields?: Record<string, unknown>
}

export interface AIParsedItem {
  name: string
  quantity: number
  unitPriceIls: number
  totalPriceIls: number
  unitCostUsd: number
  totalCostUsd: number
  isGift: boolean
  isSurprise: boolean
  type: 'deal' | 'coolDeal' | 'bottle' | 'capsule' | 'other'
}

export interface AIOrderAnalysis {
  order_summary: string
  line_items_parsed: AIParsedItem[]
  discounts_applied: Array<{
    name: string
    amount_ils: number
    type: string
  }>
  store_price_breakdown: {
    items: Array<{ name: string; amount: number }>
    subtotal: number
    shipping_customer: number
    pickup_fee: number
    total: number
  }
  my_cost_breakdown: {
    items: Array<{ name: string; amount_usd: number }>
    shipping_cost: number
    gift_capsule_cost: number
    total_usd: number
  }
  my_cost_ils: number
  gross_profit_ils: number
  payment_fee_ils: number
  vat_ils: number
  net_profit_ils: number
  net_profit_usd: number
  exchange_rate_used: number
  payment_method: string
  notes: string
}

export interface DashboardStats {
  todayRevenue: number
  todayProfit: number
  todayCost: number
  todayOrders: number
  todayAdSpend: number
  todayRoas: number
  weekRevenue: number
  weekProfit: number
  weekAdSpend: number
  monthRevenue: number
  monthProfit: number
  monthAdSpend: number
}

export interface OrderRow {
  id: string
  orderNumber: string
  orderDate: string
  customerName: string | null
  orderSummary: string | null
  storePrice: number | null
  myCostUsd: number | null
  myCostIls: number | null
  grossProfitIls: number | null
  netProfitIls: number | null
  paymentFeeIls: number | null
  vatIls: number | null
  adSpendAlloc: number | null
  paymentMethod: string | null
  status: string
  aiAnalysis: AIOrderAnalysis | null
}
