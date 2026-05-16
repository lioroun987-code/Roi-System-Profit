'use client'

import { useEffect, useState, useCallback } from 'react'
import { ProductCostsForm } from '@/components/settings/product-costs-form'
import { PriceSimulationTab } from '@/components/settings/price-simulation-tab'
import { AiConfigChat } from '@/components/settings/ai-config-chat'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProductCosts } from '@/types'

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
  secondUnitDiscount: 2,
  homeDeliveryCostUsd: 3,
  homeDeliveryChargeIls: 25,
  pickupFeeThresholdIls: 200,
  pickupFeeAmountIls: 10,
  exchangeRate: 3.7,
}

const TABS = [
  { id: 'general',    label: 'כללי' },
  { id: 'costs',      label: 'עלויות וחוקים' },
  { id: 'payment',    label: 'תשלום' },
  { id: 'simulation', label: '📈 סימולציה' },
  { id: 'ai-chat',    label: '✨ עדכן עם AI' },
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
          const pc  = business.productCosts ?? {}
          const dr  = business.discountRules ?? {}
          const customCosts: Record<string, any> = pc.customProductCosts ?? {}
          const hasCustom = Object.keys(customCosts).length > 0
          const rules: any[] = (dr as any).costRules ?? []

          return (
            <div className="space-y-8">
              {/* ── Section 1: Product costs ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full" style={{ background: '#3B82F6' }} />
                  <h3 className="text-white font-bold">עלות מוצרים</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1E2130', color: '#6B7280' }}>
                    עלות בסיסית לכל מוצר
                  </span>
                </div>
                {hasCustom
                  ? <ShopifyProductCosts pc={pc} customCosts={customCosts} onSave={(updated) => save({ productCosts: updated }, 'costs')} />
                  : <ProductCostsForm defaultValues={pc ?? DEFAULT_COSTS} onSave={async (data) => save({ productCosts: data }, 'costs')} />
                }
              </div>

              {/* ── Divider ── */}
              <div style={{ borderTop: '2px dashed #1E2130' }} />

              {/* ── Section 2: Cost rules ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full" style={{ background: '#8B5CF6' }} />
                  <h3 className="text-white font-bold">חוקי עלות</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1E2130', color: '#6B7280' }}>
                    הנחות מהסוכן ותנאים מורכבים
                  </span>
                </div>

                {rules.length === 0 ? (
                  <div className="rounded-xl p-6 text-center" style={{ background: '#13161F', border: '1px dashed #1E2130' }}>
                    <p className="text-white font-medium mb-1">אין חוקי עלות מוגדרים</p>
                    <p className="text-sm mb-3" style={{ color: '#4A5174' }}>
                      תאר לעוזר ה-AI ✨ הנחות מהסוכן שתלויות בכמות או בתנאים אחרים
                    </p>
                    <p className="text-xs px-4 py-2 rounded-xl inline-block" style={{ background: '#0D1A2A', color: '#60A5FA' }}>
                      לדוגמה: "כשקונים 2+ דילים מאותו סוג, הסוכן מוריד $3.60 לכל דיל נוסף"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {rules.map((rule: any, idx: number) => (
                      <div key={rule.id}
                        className="rounded-xl p-4 flex items-start justify-between gap-4"
                        style={{
                          background:   rule.active ? '#13161F' : '#0D0F14',
                          border:       `1px solid ${rule.active ? '#2D1F4A' : '#1A1D2A'}`,
                          opacity:      rule.active ? 1 : 0.55,
                        }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-white">{rule.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: rule.active ? '#1A0D2E' : '#1A1D2A',
                                color:      rule.active ? '#A78BFA' : '#4A5174',
                                border:     `1px solid ${rule.active ? '#4C1D95' : '#1E2130'}`,
                              }}>
                              {rule.active ? 'פעיל' : 'מושבת'}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: '#6B7280' }}>
                            {rule.condition.type === 'quantity_of_type'     && `≥${rule.condition.value} יחידות מסוג ${rule.condition.productType}`}
                            {rule.condition.type === 'quantity_same_product' && `≥${rule.condition.value} אותו מוצר`}
                            {rule.condition.type === 'total_items'           && `סך ≥${rule.condition.value} פריטים`}
                            {' → '}
                            {rule.effect.type === 'reduce_cost_per_unit'  && `הפחתה $${rule.effect.value} ליחידה נוספת`}
                            {rule.effect.type === 'set_cost_per_unit'      && `עלות $${rule.effect.value} ליחידה`}
                            {rule.effect.type === 'percent_off_total'       && `${rule.effect.value}% הנחה`}
                          </p>
                          {rule.note && <p className="text-xs mt-0.5" style={{ color: '#374151' }}>{rule.note}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={async () => {
                              const updated = rules.map((r: any, i: number) =>
                                i === idx ? { ...r, active: !r.active } : r
                              )
                              await save({ discountRules: { ...dr, costRules: updated } }, 'costs')
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                            style={{ background: '#1E2130', color: '#CBD5E1' }}>
                            {rule.active ? 'השבת' : 'הפעל'}
                          </button>
                          <button
                            onClick={async () => {
                              const updated = rules.filter((_: any, i: number) => i !== idx)
                              await save({ discountRules: { ...dr, costRules: updated } }, 'costs')
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                            style={{ background: '#2D0F0F', color: '#FCA5A5' }}>
                            מחק
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {tab === 'payment' && business && (() => {
          const ps = business.paymentSettings ?? {}
          const vatEnabled        = (ps as any).vatEnabled        ?? false
          const vatPercent        = (ps as any).vatPercent        ?? 17
          const averageFeePercent = (ps as any).averageFeePercent ?? 2.5

          return (
            <div className="space-y-6 max-w-sm">
              <div>
                <h3 className="text-white font-bold mb-1">עמלת סליקה ממוצעת</h3>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  אחוז קבוע שיחוסר מכל הזמנה — ממוצע של כל אמצעי התשלום שלך
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: '#CBD5E1' }}>עמלה %</label>
                <div className="relative max-w-xs">
                  <input
                    type="number" step="0.1" min="0" max="20"
                    defaultValue={averageFeePercent}
                    id="avg-fee"
                    style={{
                      background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1',
                      borderRadius: '10px', padding: '10px 36px 10px 14px',
                      fontSize: '16px', fontWeight: '600', outline: 'none', width: '100%',
                    }}
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: '#4A5174' }}>%</span>
                </div>
                <p className="text-xs" style={{ color: '#4A5174' }}>
                  לדוגמה: אם Bit = 3%, אשראי = 1.5% ואתה מקבל 50/50 → ממוצע ~2.25%
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={vatEnabled}
                    id="vat-enabled"
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <span className="text-sm" style={{ color: '#CBD5E1' }}>העסק גובה מע"מ</span>
                </label>
                {vatEnabled && (
                  <div className="relative max-w-xs mr-7">
                    <input
                      type="number" defaultValue={vatPercent} id="vat-percent"
                      style={{
                        background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1',
                        borderRadius: '10px', padding: '8px 36px 8px 14px',
                        fontSize: '14px', outline: 'none', width: '100%',
                      }}
                      dir="ltr"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4A5174' }}>%</span>
                  </div>
                )}
              </div>

              <button
                onClick={async () => {
                  const fee = parseFloat((document.getElementById('avg-fee') as HTMLInputElement).value) || 2.5
                  const vat = (document.getElementById('vat-enabled') as HTMLInputElement).checked
                  const vatPct = parseFloat((document.getElementById('vat-percent') as HTMLInputElement)?.value ?? '17') || 17
                  await save({
                    paymentSettings: {
                      ...(ps as any),
                      flatFeeMode: true,
                      averageFeePercent: fee,
                      vatEnabled: vat,
                      vatPercent: vatPct,
                    }
                  }, 'payment')
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}
              >
                שמור
              </button>
            </div>
          )
        })()}


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

        {tab === 'ai-chat' && activeBusiness && (
          <AiConfigChat
            businessId={activeBusiness}
            onConfigChange={fetchBusiness}
          />
        )}

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
