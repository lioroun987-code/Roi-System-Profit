'use client'

import { useEffect, useState, useCallback } from 'react'
import { ProductCostsForm } from '@/components/settings/product-costs-form'
import { DiscountRulesForm } from '@/components/settings/discount-rules-form'
import { PaymentSettingsForm } from '@/components/settings/payment-settings-form'
import { PriceSimulationTab } from '@/components/settings/price-simulation-tab'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProductCosts, DiscountRules, PaymentSettings } from '@/types'

/* ── Shopify-product cost editor ── */
function ShopifyProductCosts({ pc, customCosts, onSave }: {
  pc: any
  customCosts: Record<string, any>
  onSave: (updated: any) => Promise<void>
}) {
  const [costs, setCosts] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.entries(customCosts).map(([k, v]) => [k, v.costUsd ?? 0]))
  )
  const [shipping, setShipping] = useState({
    homeDeliveryCostUsd:   pc.homeDeliveryCostUsd   ?? 3,
    homeDeliveryChargeIls: pc.homeDeliveryChargeIls  ?? 25,
    pickupFeeThresholdIls: pc.pickupFeeThresholdIls  ?? 200,
    pickupFeeAmountIls:    pc.pickupFeeAmountIls     ?? 10,
    exchangeRate:          pc.exchangeRate            ?? 3.7,
    secondUnitDiscount:    pc.secondUnitDiscount      ?? 2,
  })
  const [saving, setSaving] = useState(false)

  const inputStyle: React.CSSProperties = {
    background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1',
    borderRadius: '8px', padding: '7px 12px', fontSize: '13px', outline: 'none', width: '110px',
  }

  async function handleSave() {
    setSaving(true)
    const updatedCustom = Object.fromEntries(
      Object.entries(customCosts).map(([k, v]) => [k, { ...v, costUsd: costs[k] ?? 0 }])
    )
    await onSave({ ...pc, customProductCosts: updatedCustom, ...shipping })
    setSaving(false)
  }

  const exchangeRate = shipping.exchangeRate

  return (
    <div className="space-y-6">
      {/* Products table */}
      <div>
        <h3 className="text-white font-semibold mb-3">מוצרים (מסונכרן מ-Shopify)</h3>
        <div className="rounded-xl overflow-hidden border border-white/10">
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase"
            style={{ background: '#0D0F14', color: '#4A5174', borderBottom: '1px solid #1E2130' }}>
            <span className="col-span-5">מוצר</span>
            <span className="col-span-3 text-right">מחיר מכירה</span>
            <span className="col-span-2 text-right">עלות שלי ($)</span>
            <span className="col-span-2 text-right">מרג׳ין</span>
          </div>
          {Object.entries(customCosts).map(([key, product]: [string, any]) => {
            const costUsd     = costs[key] ?? 0
            const costIls     = costUsd * exchangeRate
            const sellIls     = product.sellingPriceIls ?? 0
            const margin      = sellIls > 0 ? ((sellIls - costIls) / sellIls) * 100 : 0
            const marginColor = margin >= 30 ? '#22C55E' : margin >= 15 ? '#F59E0B' : '#EF4444'
            return (
              <div key={key} className="grid grid-cols-12 items-center px-4 py-3 border-b border-white/5">
                <div className="col-span-5">
                  <p className="text-sm text-white leading-tight">{product.productTitle}</p>
                  {product.variantTitle !== 'Default Title' && (
                    <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>{product.variantTitle}</p>
                  )}
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-sm" style={{ color: '#CBD5E1' }}>₪{sellIls}</span>
                </div>
                <div className="col-span-2 flex justify-end">
                  <div className="relative">
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#4A5174' }}>$</span>
                    <input type="number" step="0.01" min="0" value={costUsd || ''}
                      onChange={e => setCosts(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inputStyle, paddingRight: '22px', textAlign: 'right' }} dir="ltr" />
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  {costUsd > 0 && sellIls > 0 ? (
                    <span className="text-sm font-semibold" style={{ color: marginColor }}>
                      {margin.toFixed(0)}%
                    </span>
                  ) : <span style={{ color: '#374151' }}>—</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Shipping & exchange rate */}
      <div>
        <h3 className="text-white font-semibold mb-3">משלוח ושער חליפין</h3>
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          {([
            ['exchangeRate', 'שער חליפין ($/₪)', '$/₪'],
            ['secondUnitDiscount', 'הנחת יחידה 2+ ($)', '$'],
            ['homeDeliveryCostUsd', 'עלות משלוח לבית ($)', '$'],
            ['homeDeliveryChargeIls', 'חיוב משלוח ללקוח (₪)', '₪'],
            ['pickupFeeThresholdIls', 'סף לעמלת איסוף (₪)', '₪'],
            ['pickupFeeAmountIls', 'עמלת איסוף (₪)', '₪'],
          ] as const).map(([field, label, currency]) => (
            <div key={field} className="space-y-1">
              <label className="text-xs" style={{ color: '#6B7280' }}>{label}</label>
              <div className="relative">
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#4A5174' }}>{currency}</span>
                <input type="number" step="0.01" value={(shipping as any)[field]}
                  onChange={e => setShipping(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
                  style={{ ...inputStyle, width: '100%', paddingRight: '32px' }} dir="ltr" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:-translate-y-0.5"
        style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
        {saving ? 'שומר...' : 'שמור עלויות מוצרים'}
      </button>
    </div>
  )
}

const DEFAULT_COSTS: ProductCosts = {
  dealCost: 8.5,
  coolDealCost: 9.5,
  bottleCost: 6,
  singleCapsuleCost: 0.85,
  pack3Price: 69,
  pack7Price: 139,
  secondUnitDiscount: 2,
  homeDeliveryCostUsd: 3,
  homeDeliveryChargeIls: 25,
  pickupFeeThresholdIls: 200,
  pickupFeeAmountIls: 10,
  exchangeRate: 3.7,
}

const DEFAULT_DISCOUNTS: DiscountRules = {
  qty2Percent: 10,
  qty3Percent: 15,
  section10Percent: true,
  section15Percent: true,
  coupon50Ils: true,
  surpriseCapsuleCostUsd: 0.85,
  giftCapsuleThresholdIls: 350,
  giftCapsuleCostUsd: 0.85,
}

const DEFAULT_PAYMENT: PaymentSettings = {
  vatEnabled: false,
  vatPercent: 17,
  paymentMethods: [
    { name: 'Bit', feePercent: 3, enabled: true },
    { name: 'כרטיס אשראי רגיל', feePercent: 1, enabled: true },
    { name: 'PayPal', feePercent: 4.5, enabled: false },
  ],
}

const TABS = [
  { id: 'general',    label: 'כללי' },
  { id: 'costs',      label: 'עלויות מוצרים' },
  { id: 'discounts',  label: 'כללי הנחה' },
  { id: 'payment',    label: 'תשלום ומע"מ' },
  { id: 'simulation', label: '📈 סימולציה ומחירים' },
  { id: 'ai',         label: 'הנחיות AI' },
]

export default function SettingsPage() {
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [business, setBusiness] = useState<any>(null)
  const [tab, setTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [savedTab, setSavedTab] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [aiNotes, setAiNotes] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('activeBusiness')
    if (stored) setActiveBusiness(stored)
    const handler = (e: CustomEvent) => setActiveBusiness(e.detail)
    window.addEventListener('businessChange', handler as EventListener)
    return () => window.removeEventListener('businessChange', handler as EventListener)
  }, [])

  const fetchBusiness = useCallback(async () => {
    if (!activeBusiness) return
    const res = await fetch(`/api/businesses/${activeBusiness}`)
    const data = await res.json()
    setBusiness(data)
    setBusinessName(data.name ?? '')
    setAiNotes(data.aiNotes ?? '')
  }, [activeBusiness])

  useEffect(() => { fetchBusiness() }, [fetchBusiness])

  async function save(data: Record<string, unknown>, tabId: string) {
    if (!activeBusiness) return
    setSaving(true)
    await fetch(`/api/businesses/${activeBusiness}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSaving(false)
    setSavedTab(tabId)
    setTimeout(() => setSavedTab(null), 2000)
    fetchBusiness()
  }

  if (!activeBusiness) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">בחר עסק מהתפריט הצדדי כדי לערוך את ההגדרות</p>
        <Button onClick={() => window.location.href = '/settings/business/new'}>
          צור עסק חדש
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">הגדרות עסק</h1>

      <div className="flex gap-1 border-b border-white/10">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        {savedTab && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 text-emerald-400 text-sm">
            ✓ השינויים נשמרו בהצלחה
          </div>
        )}

        {tab === 'general' && (
          <div className="space-y-4 max-w-md">
            <h3 className="text-white font-medium">פרטי עסק</h3>
            <div className="space-y-1.5">
              <Label>שם העסק</Label>
              <Input
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="חנות האי-קומרס שלי"
              />
            </div>
            <Button
              onClick={() => save({ name: businessName }, 'general')}
              loading={saving}
            >
              שמור
            </Button>
          </div>
        )}

        {tab === 'costs' && business && (() => {
          const pc = business.productCosts ?? {}
          const customCosts: Record<string, any> = pc.customProductCosts ?? {}
          const hasCustom = Object.keys(customCosts).length > 0
          return hasCustom
            ? <ShopifyProductCosts pc={pc} customCosts={customCosts} onSave={(updated) => save({ productCosts: updated }, 'costs')} />
            : <ProductCostsForm defaultValues={pc ?? DEFAULT_COSTS} onSave={async (data) => save({ productCosts: data }, 'costs')} />
        })()}

        {tab === 'discounts' && business && (
          <DiscountRulesForm
            defaultValues={business.discountRules ?? DEFAULT_DISCOUNTS}
            onSave={async (data) => save({ discountRules: data }, 'discounts')}
          />
        )}

        {tab === 'payment' && business && (
          <PaymentSettingsForm
            defaultValues={business.paymentSettings ?? DEFAULT_PAYMENT}
            onSave={async (data) => save({ paymentSettings: data }, 'payment')}
          />
        )}

        {tab === 'simulation' && business && (() => {
          const pc = business.productCosts ?? {}
          const customProducts = pc.customProductCosts ?? {}
          const products = Object.entries(customProducts).map(([key, val]: [string, any]) => ({
            key,
            productTitle:   val.productTitle ?? key,
            variantTitle:   val.variantTitle ?? 'Default Title',
            costUsd:        val.costUsd ?? 0,
            sellingPriceIls: val.sellingPriceIls ?? 0,
          }))
          const priceHistory = pc.priceHistory ?? []
          const exchangeRate = pc.exchangeRate ?? 3.7

          async function handleSaveChange(change: any, updateCost: boolean) {
            const updatedHistory = [...priceHistory, change]
            const updatedCosts = updateCost
              ? {
                  ...customProducts,
                  [change.productKey]: {
                    ...customProducts[change.productKey],
                    costUsd: change.newValue,
                  },
                }
              : customProducts

            await save({
              productCosts: {
                ...pc,
                customProductCosts: updatedCosts,
                priceHistory: updatedHistory,
              },
            }, 'simulation')
          }

          return (
            <PriceSimulationTab
              businessId={activeBusiness!}
              products={products}
              priceHistory={priceHistory}
              exchangeRate={exchangeRate}
              onSaveChange={handleSaveChange}
            />
          )
        })()}

        {tab === 'ai' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-medium mb-2">הנחיות מיוחדות ל-AI</h3>
              <p className="text-gray-400 text-sm mb-4">
                כתוב כאן כל כלל עסקי מיוחד, מקרי קצה, הנחיות ספציפיות שה-AI צריך להכיר.
                הטקסט הזה נשלח לקלוד עם כל ניתוח הזמנה.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>הנחיות ל-AI (עברית מועדפת)</Label>
              <Textarea
                value={aiNotes}
                onChange={e => setAiNotes(e.target.value)}
                placeholder="לדוגמה: כשקונים 2 דילים עם 10% הנחה, ההנחה מחליפה את הנחת הכמות — אין כפל. אבל קופון 50 ₪ תמיד מצטבר. קפסולות הפתעה עולות לי 0.85$ כל אחת גם אם חינם ללקוח..."
                rows={10}
                className="min-h-48"
              />
            </div>
            <Button
              onClick={() => save({ aiNotes }, 'ai')}
              loading={saving}
            >
              שמור הנחיות AI
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
