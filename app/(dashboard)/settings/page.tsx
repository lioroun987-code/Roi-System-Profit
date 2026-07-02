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
    background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
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
        <div className="rounded-xl overflow-hidden border border-[var(--color-border)]">
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase"
            style={{ background: 'var(--color-bg-app)', color: 'var(--color-text-tertiary)', borderBottom: '1px solid var(--color-border)' }}>
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
            const marginColor = margin >= 30 ? 'var(--color-success)' : margin >= 15 ? 'var(--color-warning)' : 'var(--color-danger)'
            return (
              <div key={key} className="grid grid-cols-12 items-center px-4 py-3 border-b border-[var(--color-border)]/50">
                <div className="col-span-5">
                  <p className="text-sm text-white leading-tight">{product.productTitle}</p>
                  {product.variantTitle !== 'Default Title' && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{product.variantTitle}</p>
                  )}
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>₪{sellIls}</span>
                </div>
                <div className="col-span-2 flex justify-end">
                  <div className="relative">
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>$</span>
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
                  ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
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
              <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
              <div className="relative">
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{currency}</span>
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
        style={{ background: 'linear-gradient(135deg, var(--color-brand-start), var(--color-accent-indigo))' }}>
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
  { id: 'costs',      label: 'עלויות' },
  { id: 'rules',      label: 'חוקים והנחיות' },
  { id: 'payment',    label: 'תשלום' },
  { id: 'simulation', label: '📈 סימולציה' },
  { id: 'ai-chat',    label: '✨ עדכן עם AI' },
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
        <p className="text-[var(--color-text-secondary)] mb-4">בחר עסק מהתפריט הצדדי כדי לערוך את ההגדרות</p>
        <Button onClick={() => window.location.href = '/settings/business/new'}>
          צור עסק חדש
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">הגדרות עסק</h1>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[var(--color-brand-start)] text-[var(--color-brand-start)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-6">
        {savedTab && (
          <div className="mb-4 tint-success border border-[var(--color-success)]/30 rounded-lg px-4 py-2 text-[var(--color-success)] text-sm">
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
          const customCosts: Record<string, any> = pc.customProductCosts ?? {}
          const hasCustom = Object.keys(customCosts).length > 0
          return hasCustom
            ? <ShopifyProductCosts pc={pc} customCosts={customCosts} onSave={(updated) => save({ productCosts: updated }, 'costs')} />
            : <ProductCostsForm defaultValues={pc ?? DEFAULT_COSTS} onSave={async (data) => save({ productCosts: data }, 'costs')} />
        })()}

        {tab === 'rules' && business && (() => {
          const dr    = business.discountRules ?? {}
          const rules: any[] = (dr as any).costRules ?? []
          const notes: string = business.aiNotes ?? ''

          const ruleDescription = (rule: any) => {
            const c = rule.condition
            const e = rule.effect
            const cond =
              c.type === 'quantity_of_type'      ? `כשיש ${c.operator === '>=' ? 'לפחות' : ''} ${c.value} יחידות מסוג "${c.productType}"` :
              c.type === 'quantity_same_product'  ? `כשיש לפחות ${c.value} מאותו מוצר` :
              c.type === 'total_items'            ? `כשיש סך הכל לפחות ${c.value} פריטים בהזמנה` :
              c.type === 'product_in_order'       ? `כש"${c.productType ?? c.productKey}" נמצא בהזמנה` :
              c.type === 'customer_price_is_zero' ? `כשהלקוח קיבל "${c.productType ?? c.productKey ?? 'מוצר'}" בחינם` :
              c.type
            const eff =
              e.type === 'reduce_cost_per_unit' ? `הסוכן מוריד $${e.value} מהעלות לכל יחידה נוספת` :
              e.type === 'set_cost_per_unit'    ? `העלות נקבעת ל-$${e.value} ליחידה${e.productKey ? ` (רק עבור "${e.productKey}")` : ''}` :
              e.type === 'percent_off_total'    ? `${e.value}% הנחה על סך העלות` :
              e.type
            return { cond, eff }
          }

          return (
            <div className="space-y-8">

              {/* ── Cost rules ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-accent-violet) 20%, var(--color-bg-app))' }}>
                      <span style={{ fontSize: 16 }}>⚙️</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold">חוקי עלות</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>חוקים שה-AI הגדיר לחישוב עלות מדויק</p>
                    </div>
                    {rules.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'color-mix(in srgb, var(--color-accent-violet) 20%, var(--color-bg-app))', color: 'var(--color-accent-violet)' }}>
                        {rules.filter(r => r.active).length} פעילים
                      </span>
                    )}
                  </div>
                </div>

                {rules.length === 0 ? (
                  <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-bg-app)', border: '2px dashed var(--color-border)' }}>
                    <p className="text-2xl mb-2">⚙️</p>
                    <p className="text-white font-medium mb-1">אין חוקים מוגדרים עדיין</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>לחץ על "עדכן עם AI" ✨ ותאר כל חוק עסקי</p>
                    <p className="text-xs mt-3 px-4 py-2 rounded-lg inline-block" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))', color: 'var(--color-brand-start)' }}>
                      לדוגמה: "כשקונים 2+ דילים מאותו סוג, הסוכן מוריד $3.60 לכל דיל נוסף"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule: any, idx: number) => {
                      const { cond, eff } = ruleDescription(rule)
                      return (
                        <div key={rule.id} className="rounded-xl overflow-hidden"
                          style={{ border: `1px solid ${rule.active ? 'color-mix(in srgb, var(--color-accent-violet) 35%, var(--color-bg-app))' : 'var(--color-border)'}`, opacity: rule.active ? 1 : 0.6 }}>
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-3"
                            style={{ background: rule.active ? 'color-mix(in srgb, var(--color-accent-violet) 12%, var(--color-bg-app))' : 'var(--color-bg-app)', borderBottom: `1px solid ${rule.active ? 'color-mix(in srgb, var(--color-accent-violet) 35%, var(--color-bg-app))' : 'var(--color-border)'}` }}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{rule.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: rule.active ? 'color-mix(in srgb, var(--color-accent-violet) 20%, var(--color-bg-app))' : 'var(--color-bg-surface-alt)', color: rule.active ? 'var(--color-accent-violet)' : 'var(--color-text-secondary)' }}>
                                {rule.active ? '● פעיל' : '○ מושבת'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={async () => {
                                const updated = rules.map((r: any, i: number) => i === idx ? { ...r, active: !r.active } : r)
                                await save({ discountRules: { ...dr, costRules: updated } }, 'rules')
                              }} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                {rule.active ? 'השבת' : 'הפעל'}
                              </button>
                              <button onClick={async () => {
                                if (!confirm('למחוק את החוק הזה?')) return
                                const updated = rules.filter((_: any, i: number) => i !== idx)
                                await save({ discountRules: { ...dr, costRules: updated } }, 'rules')
                              }} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-danger) 20%, var(--color-bg-app))', color: 'var(--color-danger)' }}>
                                מחק
                              </button>
                            </div>
                          </div>
                          {/* Body */}
                          <div className="px-4 py-3 space-y-2" style={{ background: 'var(--color-bg-app)' }}>
                            <div className="flex items-start gap-2">
                              <span className="text-xs mt-0.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>תנאי:</span>
                              <span className="text-sm text-white">{cond}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-xs mt-0.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>אז:</span>
                              <span className="text-sm font-medium" style={{ color: 'var(--color-accent-violet)' }}>{eff}</span>
                            </div>
                            {rule.note && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs mt-0.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>הערה:</span>
                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{rule.note}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── AI Notes ── */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '2rem' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))' }}>
                    <span style={{ fontSize: 16 }}>📋</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold">הנחיות מיוחדות ל-AI</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>הוראות חופשיות שה-AI משתמש בהן לכל ניתוח הזמנה</p>
                  </div>
                </div>

                {notes ? (
                  <div className="rounded-xl p-4 whitespace-pre-wrap text-sm leading-relaxed"
                    style={{ background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                    {notes}
                  </div>
                ) : (
                  <div className="rounded-xl p-6 text-center" style={{ background: 'var(--color-bg-app)', border: '2px dashed var(--color-border)' }}>
                    <p className="text-white font-medium mb-1">אין הנחיות מיוחדות</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>ניתן להוסיף הנחיות דרך "עדכן עם AI" ✨</p>
                  </div>
                )}

                {notes && (
                  <button onClick={() => save({ aiNotes: '' }, 'rules')}
                    className="mt-3 text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: 'color-mix(in srgb, var(--color-danger) 20%, var(--color-bg-app))', color: 'var(--color-danger)' }}>
                    נקה הנחיות
                  </button>
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
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  אחוז קבוע שיחוסר מכל הזמנה — ממוצע של כל אמצעי התשלום שלך
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>עמלה %</label>
                <div className="relative max-w-xs">
                  <input
                    type="number" step="0.1" min="0" max="20"
                    defaultValue={averageFeePercent}
                    id="avg-fee"
                    style={{
                      background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
                      borderRadius: '10px', padding: '10px 36px 10px 14px',
                      fontSize: '16px', fontWeight: '600', outline: 'none', width: '100%',
                    }}
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>%</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  לדוגמה: אם Bit = 3%, אשראי = 1.5% ואתה מקבל 50/50 → ממוצע ~2.25%
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={vatEnabled}
                    id="vat-enabled"
                    className="w-4 h-4 rounded accent-[var(--color-brand-start)]"
                  />
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>העסק גובה מע"מ</span>
                </label>
                {vatEnabled && (
                  <div className="relative max-w-xs mr-7">
                    <input
                      type="number" defaultValue={vatPercent} id="vat-percent"
                      style={{
                        background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
                        borderRadius: '10px', padding: '8px 36px 8px 14px',
                        fontSize: '14px', outline: 'none', width: '100%',
                      }}
                      dir="ltr"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>%</span>
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
                style={{ background: 'linear-gradient(135deg, var(--color-brand-start), var(--color-accent-indigo))' }}
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

      </div>
    </div>
  )
}
