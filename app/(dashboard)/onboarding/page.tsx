'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, ChevronLeft, ChevronRight, Store, DollarSign, Megaphone,
  CreditCard, Bot, Rocket, Loader2, Package, Truck, TrendingUp,
} from 'lucide-react'

/* ── Types ── */
interface ShopifyVariant { id: string; title: string; sku: string; price: string }
interface ShopifyProduct { id: string; title: string; image: string | null; variants: ShopifyVariant[] }

const STEPS = [
  { id: 'welcome',  label: 'ברוך הבא',       icon: Rocket },
  { id: 'shopify',  label: 'Shopify',         icon: Store },
  { id: 'products', label: 'עלויות מוצרים',  icon: DollarSign },
  { id: 'ads',      label: 'פרסום',           icon: Megaphone },
  { id: 'payment',  label: 'תשלום',           icon: CreditCard },
  { id: 'ai',       label: 'הנחיות AI',       icon: Bot },
]

/* ─────────────────────── Step indicator ─────────────────────── */
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-10">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const done   = i < current
        const active = i === current
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background:   active ? 'var(--color-brand-start)' : done ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))' : 'var(--color-bg-app)',
                color:        active ? '#fff'    : done ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                border: `1px solid ${active ? 'var(--color-brand-start)' : done ? 'color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' : 'var(--color-border)'}`,
              }}>
              {done ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-4 h-px" style={{ background: done ? 'color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' : 'var(--color-border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────── Live margin badge ─────────────────────── */
function MarginBadge({ costUsd, sellingPriceIls, exchangeRate }: {
  costUsd: number; sellingPriceIls: number; exchangeRate: number
}) {
  if (!costUsd || !sellingPriceIls) return null
  const costIls  = costUsd * exchangeRate
  const profit   = sellingPriceIls - costIls
  const margin   = (profit / sellingPriceIls) * 100
  const color    = margin >= 30 ? 'var(--color-success)' : margin >= 15 ? 'var(--color-warning)' : 'var(--color-danger)'
  const bg       = margin >= 30 ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))'  : margin >= 15 ? 'color-mix(in srgb, var(--color-warning) 20%, var(--color-bg-app))' : 'color-mix(in srgb, var(--color-danger) 20%, var(--color-bg-app))'
  return (
    <div className="flex items-center gap-2 mt-2.5 text-xs">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(Math.max(margin, 0), 100)}%`, background: color }} />
      </div>
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ background: bg, color }}>
        <TrendingUp className="w-3 h-3" />
        {margin.toFixed(0)}%
      </div>
      <span style={{ color: 'var(--color-text-tertiary)' }}>₪{profit.toFixed(0)} רווח גולמי</span>
    </div>
  )
}

/* ─────────────────────── Main Wizard ─────────────────────── */
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]       = useState(0)
  const [saving, setSaving]   = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)

  // Step 0
  const [businessName, setBusinessName] = useState('')
  const [exchangeRate, setExchangeRate] = useState(3.7)

  // Step 1 — Shopify
  const [shopifyDomain, setShopifyDomain]       = useState('')
  const [shopifyConnected, setShopifyConnected] = useState(false)

  // Step 2 — Products
  const [products, setProducts]               = useState<ShopifyProduct[]>([])
  const [productCosts, setProductCosts]       = useState<Record<string, number>>({})
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [homeDeliveryCostUsd, setHomeDeliveryCostUsd]         = useState(3)
  const [homeDeliveryChargeIls, setHomeDeliveryChargeIls]     = useState(25)
  const [pickupFeeThresholdIls, setPickupFeeThresholdIls]     = useState(200)
  const [pickupFeeAmountIls, setPickupFeeAmountIls]           = useState(10)
  // AI description mode
  const [aiMode, setAiMode]             = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [aiParsing, setAiParsing]       = useState(false)
  const [aiResult, setAiResult]         = useState<any>(null)
  const [aiError, setAiError]           = useState('')

  // Step 3 — Ads
  const [fbAdAccountId, setFbAdAccountId] = useState('')
  const [fbAccessToken, setFbAccessToken] = useState('')

  // Step 4 — Payment
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatPercent, setVatPercent] = useState(17)
  const [flatFeeMode, setFlatFeeMode] = useState(false)
  const [averageFeePercent, setAverageFeePercent] = useState(2.5)
  const [paymentMethods, setPaymentMethods] = useState([
    { name: 'Bit',          feePercent: 3,   enabled: true  },
    { name: 'כרטיס אשראי', feePercent: 1.5, enabled: true  },
    { name: 'Apple Pay',    feePercent: 1.5, enabled: true  },
    { name: 'Google Pay',   feePercent: 1.5, enabled: true  },
    { name: 'PayPal',       feePercent: 4.5, enabled: false },
    { name: 'מזומן',        feePercent: 0,   enabled: false },
    { name: 'HYP / Cardcom', feePercent: 1.5, enabled: false },
  ])

  // Step 5 — AI
  const [aiNotes, setAiNotes] = useState('')

  useEffect(() => {
    const id = localStorage.getItem('activeBusiness')
    if (id) setBusinessId(id)

    const params = new URLSearchParams(window.location.search)

    // Detect return from Shopify OAuth
    if (params.get('shopify') === 'connected') {
      const bid = params.get('business') ?? id
      if (bid) {
        setBusinessId(bid)
        localStorage.setItem('activeBusiness', bid)
        setShopifyConnected(true)
        setStep(2)
        fetchProducts(bid)
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
    }

    // Resume from saved step
    const savedStep = params.get('step')
    if (savedStep) {
      const s = parseInt(savedStep)
      if (!isNaN(s) && s > 0) setStep(s)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  /* ── Create business ── */
  async function createBusiness() {
    if (!businessName.trim()) return null
    setSaving(true)
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: businessName }),
      })
      const data = await res.json()
      if (res.ok) {
        setBusinessId(data.id)
        localStorage.setItem('activeBusiness', data.id)
        return data.id
      }
    } finally { setSaving(false) }
    return null
  }

  /* ── Connect Shopify via OAuth ── */
  function connectShopify() {
    if (!shopifyDomain.trim() || !businessId) return
    const domain = shopifyDomain.includes('.myshopify.com')
      ? shopifyDomain.trim()
      : `${shopifyDomain.trim()}.myshopify.com`
    window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(domain)}&businessId=${businessId}&returnTo=onboarding`
  }

  /* ── Fetch products ── */
  async function fetchProducts(bid: string) {
    setLoadingProducts(true)
    try {
      const res = await fetch(`/api/shopify/products?businessId=${bid}`)
      const data = await res.json()
      if (data.products) {
        setProducts(data.products)
        const init: Record<string, number> = {}
        data.products.forEach((p: ShopifyProduct) =>
          p.variants.forEach(v => { init[`${p.id}_${v.id}`] = 0 })
        )
        setProductCosts(init)
      }
    } finally { setLoadingProducts(false) }
  }

  /* ── AI parse description ── */
  async function parseWithAI() {
    if (!aiDescription.trim() || !businessId) return
    setAiParsing(true)
    setAiError('')
    setAiResult(null)
    try {
      const res = await fetch('/api/ai/parse-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, description: aiDescription, products }),
      })
      let data: any
      try {
        data = await res.json()
      } catch {
        setAiError('שגיאת שרת — בדוק שה-ANTHROPIC_API_KEY מוגדר ב-Vercel')
        return
      }
      if (!res.ok || data.error) { setAiError(data.error ?? 'שגיאה'); return }

      const { parsed } = data
      setAiResult(parsed)

      // Apply parsed product costs
      if (parsed.productCosts) {
        const newCosts: Record<string, number> = { ...productCosts }
        for (const [key, val] of Object.entries(parsed.productCosts as Record<string, any>)) {
          if (val.costUsd > 0) newCosts[key] = val.costUsd
        }
        setProductCosts(newCosts)
      }
      // Apply shipping & discount settings
      if (parsed.shippingSettings) {
        if (parsed.shippingSettings.homeDeliveryCostUsd)  setHomeDeliveryCostUsd(parsed.shippingSettings.homeDeliveryCostUsd)
        if (parsed.shippingSettings.homeDeliveryChargeIls) setHomeDeliveryChargeIls(parsed.shippingSettings.homeDeliveryChargeIls)
        if (parsed.shippingSettings.pickupFeeThresholdIls) setPickupFeeThresholdIls(parsed.shippingSettings.pickupFeeThresholdIls)
        if (parsed.shippingSettings.pickupFeeAmountIls)    setPickupFeeAmountIls(parsed.shippingSettings.pickupFeeAmountIls)
      }
      if (parsed.exchangeRate) setExchangeRate(parsed.exchangeRate)
    } catch (e: any) {
      setAiError(e?.message ?? 'שגיאת שרת')
    } finally {
      setAiParsing(false)
    }
  }

  /* ── Save & finish ── */
  async function finish() {
    if (!businessId) return
    setSaving(true)

    const customProductCosts: Record<string, any> = {}
    products.forEach(p => p.variants.forEach(v => {
      const key = `${p.id}_${v.id}`
      customProductCosts[key] = {
        productId:      p.id,
        variantId:      v.id,
        productTitle:   p.title,
        variantTitle:   v.title,
        costUsd:        productCosts[key] ?? 0,
        sellingPriceIls: parseFloat(v.price) || 0,
      }
    }))

    await fetch(`/api/businesses/${businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productCosts: {
          customProductCosts,
          homeDeliveryCostUsd,
          homeDeliveryChargeIls,
          pickupFeeThresholdIls,
          pickupFeeAmountIls,
          exchangeRate,
          secondUnitDiscount: 2,
        },
        // Save AI-detected discount rules if available
        ...(aiResult?.discountRules ? { discountRules: aiResult.discountRules } : {}),
        paymentSettings: { vatEnabled, vatPercent, flatFeeMode, averageFeePercent, paymentMethods },
        aiNotes,
        ...(fbAdAccountId ? { fbAdAccountId } : {}),
        ...(fbAccessToken ? { fbAccessToken } : {}),
      }),
    })

    setSaving(false)
    // Mark onboarding complete in localStorage
    if (businessId) {
      localStorage.setItem(`onboarding_done_${businessId}`, '1')
      localStorage.removeItem(`onboarding_step_${businessId}`)
    }
    router.push('/dashboard')
  }

  /* ── Save step to localStorage ── */
  function saveStep(newStep: number, bid?: string) {
    const id = bid ?? businessId
    if (id) localStorage.setItem(`onboarding_step_${id}`, String(newStep))
  }

  /* ── Navigation ── */
  async function next() {
    if (step === 0) {
      if (!businessName.trim()) return
      const id = businessId ?? await createBusiness()
      if (!id) return
      saveStep(1, id)
      setStep(1)
      return
    }
    if (step === STEPS.length - 1) { finish(); return }
    const nextStep = step + 1
    saveStep(nextStep)
    setStep(nextStep)
  }
  function prev() {
    const prevStep = Math.max(0, step - 1)
    saveStep(prevStep)
    setStep(prevStep)
  }

  /* ── Shared styles ── */
  const inputStyle: React.CSSProperties = {
    background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
    borderRadius: '10px', padding: '10px 14px', fontSize: '14px',
    outline: 'none', width: '100%',
  }

  const filledCount   = Object.values(productCosts).filter(v => v > 0).length
  const totalVariants = products.reduce((s, p) => s + p.variants.length, 0)

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8" style={{ background: 'var(--color-bg-app)' }}>
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-start), var(--color-accent-indigo))' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M16 7h6v6M22 7l-8.5 8.5-5-5L2 17" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">רווחיות</span>
        </div>

        <StepBar current={step} />

        <div className="rounded-2xl border" style={{ background: 'var(--color-bg-app)', borderColor: 'var(--color-border)' }}>

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">ברוך הבא 👋</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>בוא נגדיר את העסק שלך תוך כמה דקות.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>שם העסק / החנות</label>
                <input style={inputStyle} value={businessName}
                  onChange={e => setBusinessName(e.target.value)} placeholder="חנות הקפסולות שלי" autoFocus />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>שער חליפין דולר–שקל</label>
                <div className="relative max-w-xs">
                  <input style={{ ...inputStyle, paddingLeft: '48px' }} type="number" step="0.01"
                    value={exchangeRate} onChange={e => setExchangeRate(parseFloat(e.target.value) || 3.7)} dir="ltr" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>₪/$</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>כל חישובי הרווח יתבצעו לפי שער זה</p>
              </div>
            </div>
          )}

          {/* ── Step 1: Shopify ── */}
          {step === 1 && (
            <div className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">חיבור Shopify</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>חבר את החנות — נמשוך מוצרים, נגדיר כללים אוטומטית ונעבד את כל ההיסטוריה.</p>
              </div>

              {shopifyConnected ? (
                <div className="flex items-center gap-3 p-4 rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', border: '1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' }}>
                  <CheckCircle className="w-6 h-6 shrink-0" style={{ color: 'var(--color-success)' }} />
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: 'var(--color-success)' }}>Shopify מחובר בהצלחה!</p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      מוצרים ברקע — ממשיכים להגדרת עלויות
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* What happens explanation */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                    <p className="text-sm font-medium text-white">מה קורה לאחר החיבור:</p>
                    {[
                      { icon: '📦', text: 'מושכים את כל המוצרים שלך אוטומטית' },
                      { icon: '🤖', text: 'AI מנתח את דפוסי ההנחה ואמצעי התשלום שלך' },
                      { icon: '📊', text: 'מעבדים את כל היסטוריית ההזמנות שלך' },
                    ].map(item => (
                      <div key={item.text} className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <span>{item.icon}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>דומיין החנות</label>
                    <input
                      style={inputStyle} dir="ltr"
                      value={shopifyDomain}
                      onChange={e => setShopifyDomain(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && connectShopify()}
                      placeholder="your-store.myshopify.com"
                    />
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      הכתובת שמופיעה ב-URL של אדמין שופיפיי שלך
                    </p>
                  </div>

                  <button
                    onClick={connectShopify}
                    disabled={!shopifyDomain.trim() || !businessId}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white disabled:opacity-40 transition-all hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, var(--color-brand-start), var(--color-accent-indigo))' }}>
                    <Store className="w-5 h-5" />
                    התחבר עם Shopify
                  </button>

                  <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                    תועבר לדף אישור Shopify ותחזור אוטומטית
                  </p>
                </>
              )}

              <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                  אין לך Shopify עדיין?{' '}
                  <button onClick={() => setStep(2)} className="hover:underline" style={{ color: 'var(--color-brand-start)' }}>
                    דלג לשלב הבא
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Products ── */}
          {step === 2 && (
            <div className="p-8 space-y-6">

              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">עלויות המוצרים שלך</h2>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    כמה עולה לך כל מוצר? נשתמש בזה לחישוב הרווח הנקי על כל הזמנה.
                  </p>
                </div>
                {totalVariants > 0 && (
                  <div className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0"
                    style={{
                      background: filledCount === totalVariants ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))' : 'var(--color-bg-surface)',
                      color:      filledCount === totalVariants ? 'var(--color-success)' : 'var(--color-text-secondary)',
                      border: `1px solid ${filledCount === totalVariants ? 'color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' : 'var(--color-border)'}`,
                    }}>
                    {filledCount}/{totalVariants} מוצרים
                  </div>
                )}
              </div>

              {/* AI / Manual toggle */}
              <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                {[
                  { id: false, label: '✏️ מלא ידנית' },
                  { id: true,  label: '🤖 תאר ל-AI' },
                ].map(opt => (
                  <button key={String(opt.id)} onClick={() => { setAiMode(opt.id); setAiResult(null) }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: aiMode === opt.id ? 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))' : 'transparent',
                      color:      aiMode === opt.id ? 'var(--color-brand-start)' : 'var(--color-text-secondary)',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* ── AI Mode ── */}
              {aiMode && (
                <div className="space-y-4">
                  <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))', border: '1px solid color-mix(in srgb, var(--color-brand-start) 35%, var(--color-bg-app))' }}>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-brand-start)' }}>💡 תאר בחופשיות — לדוגמה:</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                      "דיל עולה לי 8.5$, קול דיל 9.5$, בקבוק בלבד 6$, קפסולה 0.85 סנט.
                      הנחה: 2 דילים = 10%, 3 דילים = 15%. קופון 50₪ מצטבר.
                      משלוח עולה לי 3$ ואני גובה 25₪. איסוף עצמי מתחת 200₪ = עמלה 10₪."
                    </p>
                  </div>

                  <textarea
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                    placeholder="תאר את העסק שלך — עלויות מוצרים, הנחות, כמה עולה לך משלוח..."
                    rows={6}
                    style={{ ...inputStyle, resize: 'none', lineHeight: '1.7' }}
                  />

                  {aiError && (
                    <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-danger) 20%, var(--color-bg-app))', color: 'var(--color-danger)' }}>
                      {aiError}
                    </p>
                  )}

                  <button onClick={parseWithAI} disabled={aiParsing || !aiDescription.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-all hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, var(--color-accent-indigo), var(--color-accent-violet))' }}>
                    {aiParsing
                      ? <><Loader2 className="w-4 h-4 animate-spin" />מנתח...</>
                      : <>🤖 נתח ומלא אוטומטית</>}
                  </button>

                  {/* AI Result Summary */}
                  {aiResult && (
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' }}>
                      <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))' }}>
                        <span style={{ color: 'var(--color-success)' }}>✓</span>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>AI מילא את הפרטים — בדוק ואשר</p>
                      </div>

                      <div className="p-4 space-y-4" style={{ background: 'color-mix(in srgb, var(--color-success) 12%, var(--color-bg-app))' }}>
                        {/* Summary text */}
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-success)' }}>
                          {aiResult.summary}
                        </p>

                        {/* Product costs */}
                        {aiResult.productCosts && Object.keys(aiResult.productCosts).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>עלויות שזוהו</p>
                            <div className="space-y-1.5">
                              {Object.entries(aiResult.productCosts as Record<string, any>).map(([key, val]) => {
                                const product = products.find(p =>
                                  p.variants.some(v => `${p.id}_${v.id}` === key)
                                )
                                const variant = product?.variants.find(v => `${product.id}_${v.id}` === key)
                                const name = product
                                  ? `${product.title}${variant?.title !== 'Default Title' ? ` / ${variant?.title}` : ''}`
                                  : key
                                return (
                                  <div key={key} className="flex items-center justify-between text-sm">
                                    <span style={{ color: 'var(--color-text-primary)' }}>{name}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold" style={{ color: 'var(--color-success)' }}>${val.costUsd}</span>
                                      {val.reasoning && (
                                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{val.reasoning}</span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Discount rules */}
                        {aiResult.discountRules && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>כללי הנחה</p>
                            <div className="flex flex-wrap gap-2">
                              {aiResult.discountRules.qty2Percent > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' }}>
                                  {aiResult.discountRules.qty2Percent}% על 2+
                                </span>
                              )}
                              {aiResult.discountRules.qty3Percent > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' }}>
                                  {aiResult.discountRules.qty3Percent}% על 3+
                                </span>
                              )}
                              {aiResult.discountRules.coupon50Ils && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' }}>
                                  קופון ₪50
                                </span>
                              )}
                              {aiResult.discountRules.section10Percent && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' }}>
                                  סקשן 10%
                                </span>
                              )}
                              {aiResult.discountRules.section15Percent && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' }}>
                                  סקשן 15%
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Shipping */}
                        {aiResult.shippingSettings && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>משלוח</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {aiResult.shippingSettings.homeDeliveryCostUsd > 0 && (
                                <span style={{ color: 'var(--color-success)' }}>עלות לבית: ${aiResult.shippingSettings.homeDeliveryCostUsd}</span>
                              )}
                              {aiResult.shippingSettings.homeDeliveryChargeIls > 0 && (
                                <span style={{ color: 'var(--color-success)' }}>חיוב לקוח: ₪{aiResult.shippingSettings.homeDeliveryChargeIls}</span>
                              )}
                              {aiResult.shippingSettings.pickupFeeThresholdIls > 0 && (
                                <span style={{ color: 'var(--color-success)' }}>סף איסוף: ₪{aiResult.shippingSettings.pickupFeeThresholdIls}</span>
                              )}
                              {aiResult.shippingSettings.pickupFeeAmountIls > 0 && (
                                <span style={{ color: 'var(--color-success)' }}>עמלת איסוף: ₪{aiResult.shippingSettings.pickupFeeAmountIls}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Warnings */}
                        {aiResult.warnings?.length > 0 && (
                          <div className="rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--color-warning) 20%, var(--color-bg-app))' }}>
                            {aiResult.warnings.map((w: string, i: number) => (
                              <p key={i} className="text-xs" style={{ color: 'var(--color-warning)' }}>⚠️ {w}</p>
                            ))}
                          </div>
                        )}

                        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          הערכים מולאו בטופס למטה — תוכל לעדכן ידנית לפני שמירה
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Products list */}
              {loadingProducts ? (
                <div className="flex items-center justify-center py-16 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-brand-start)' }} />
                  <span style={{ color: 'var(--color-text-secondary)' }}>טוען מוצרים מ-Shopify...</span>
                </div>

              ) : products.length > 0 ? (
                <div className="space-y-3 max-h-[460px] overflow-y-auto" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
                  {products.map(product => (
                    <div key={product.id} className="rounded-2xl overflow-hidden"
                      style={{ border: '1px solid var(--color-border)' }}>

                      {/* Product header */}
                      <div className="flex items-center gap-3 px-4 py-3"
                        style={{ background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)' }}>
                        {product.image ? (
                          <img src={product.image} alt={product.title}
                            className="w-12 h-12 rounded-xl object-cover"
                            style={{ border: '1px solid var(--color-border)' }} />
                        ) : (
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--color-bg-app)', border: '1px solid var(--color-border)' }}>
                            <Package className="w-5 h-5" style={{ color: 'var(--color-text-tertiary)' }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white text-sm leading-tight">{product.title}</h4>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                            {product.variants.length} וריאנט{product.variants.length !== 1 ? 'ים' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Variant rows */}
                      <div style={{ background: 'var(--color-bg-app)' }}>
                        {product.variants.map((variant, vi) => {
                          const key      = `${product.id}_${variant.id}`
                          const cost     = productCosts[key] || 0
                          const sellIls  = parseFloat(variant.price) || 0
                          const isLast   = vi === product.variants.length - 1
                          return (
                            <div key={variant.id} className="px-4 py-4"
                              style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-bg-surface)' }}>

                              {/* Top row: name + price + input */}
                              <div className="flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white leading-tight">
                                    {variant.title === 'Default Title' ? product.title : variant.title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                      מחיר מכירה:&nbsp;
                                      <strong className="text-white">₪{sellIls}</strong>
                                    </span>
                                    {variant.sku && (
                                      <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                        SKU: {variant.sku}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Cost input */}
                                <div className="shrink-0 flex items-center gap-2">
                                  <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                                      style={{ color: 'var(--color-text-tertiary)' }}>$</span>
                                    <input
                                      type="number" step="0.01" min="0" placeholder="0.00"
                                      value={cost || ''}
                                      onChange={e => setProductCosts(prev => ({
                                        ...prev,
                                        [key]: parseFloat(e.target.value) || 0,
                                      }))}
                                      style={{
                                        ...inputStyle,
                                        width: '110px',
                                        paddingRight: '26px',
                                        paddingLeft: '10px',
                                        textAlign: 'left',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        color: cost > 0 ? 'white' : 'var(--color-text-tertiary)',
                                      }}
                                      dir="ltr"
                                    />
                                  </div>
                                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>USD</span>
                                </div>
                              </div>

                              {/* Live margin bar */}
                              {cost > 0 && (
                                <MarginBadge costUsd={cost} sellingPriceIls={sellIls} exchangeRate={exchangeRate} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

              ) : (
                <div className="text-center py-16 rounded-2xl" style={{ border: '1px dashed var(--color-border)' }}>
                  <Store className="w-12 h-12 mx-auto mb-4 text-white opacity-10" />
                  <p className="text-white font-medium mb-2">לא נמצאו מוצרים</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                    חבר Shopify בשלב הקודם כדי למשוך מוצרים אוטומטית
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    ניתן לדלג ולהגדיר עלויות מאוחר יותר בהגדרות
                  </p>
                </div>
              )}

              {/* Delivery settings */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4" style={{ color: 'var(--color-brand-start)' }} />
                  <h4 className="font-semibold text-white text-sm">הגדרות משלוח</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>עלות משלוח לבית (לעסק)</label>
                    <div className="relative">
                      <input type="number" step="0.01" value={homeDeliveryCostUsd}
                        onChange={e => setHomeDeliveryCostUsd(parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, paddingLeft: '28px' }} dir="ltr" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>$</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>חיוב משלוח ללקוח</label>
                    <div className="relative">
                      <input type="number" value={homeDeliveryChargeIls}
                        onChange={e => setHomeDeliveryChargeIls(parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, paddingLeft: '28px' }} dir="ltr" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>₪</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>סף לעמלת איסוף עצמי</label>
                    <div className="relative">
                      <input type="number" value={pickupFeeThresholdIls}
                        onChange={e => setPickupFeeThresholdIls(parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, paddingLeft: '28px' }} dir="ltr" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>₪</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>הזמנות מתחת לסף = חיוב עמלה</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>עמלת איסוף עצמי</label>
                    <div className="relative">
                      <input type="number" value={pickupFeeAmountIls}
                        onChange={e => setPickupFeeAmountIls(parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, paddingLeft: '28px' }} dir="ltr" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>₪</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Ads ── */}
          {step === 3 && (
            <div className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">חיבור פרסום</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>חבר פלטפורמות פרסום לחישוב ROAS אמיתי על בסיס רווח נקי.</p>
              </div>

              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 35%, var(--color-bg-app))' }}>
                    <span className="font-bold text-sm" style={{ color: 'var(--color-brand-start)' }}>f</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Facebook / Meta Ads</h4>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>משוך הוצאות יומיות אוטומטית</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Ad Account ID</label>
                    <input style={inputStyle} dir="ltr" value={fbAdAccountId}
                      onChange={e => setFbAdAccountId(e.target.value)} placeholder="123456789" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Access Token</label>
                    <input style={inputStyle} dir="ltr" type="password" value={fbAccessToken}
                      onChange={e => setFbAccessToken(e.target.value)} placeholder="EAAx..." />
                  </div>
                </div>
              </div>

              <p className="text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                ניתן לדלג ולחבר מאוחר יותר מדף האינטגרציות
              </p>
            </div>
          )}

          {/* ── Step 4: Payment ── */}
          {step === 4 && (
            <div className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">הגדרות תשלום ומע"מ</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>עמלות אמצעי התשלום יורדו אוטומטית מהרווח בכל הזמנה.</p>
              </div>

              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                <h4 className="text-white font-medium">מע"מ</h4>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={vatEnabled}
                    onChange={e => setVatEnabled(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>העסק גובה מע"מ</span>
                </label>
                {vatEnabled && (
                  <div className="relative max-w-xs">
                    <input type="number" value={vatPercent}
                      onChange={e => setVatPercent(parseFloat(e.target.value) || 17)}
                      style={{ ...inputStyle, paddingLeft: '32px' }} dir="ltr" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>%</span>
                  </div>
                )}
              </div>

              {/* Fee mode toggle */}
              <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                {[
                  { val: false, label: '📋 לפי אמצעי תשלום' },
                  { val: true,  label: '⚡ עמלה ממוצעת קבועה' },
                ].map(opt => (
                  <button key={String(opt.val)} onClick={() => setFlatFeeMode(opt.val)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: flatFeeMode === opt.val ? 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))' : 'transparent',
                      color:      flatFeeMode === opt.val ? 'var(--color-brand-start)' : 'var(--color-text-secondary)',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {flatFeeMode ? (
                /* Flat average fee */
                <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                  <div>
                    <h4 className="text-white font-medium mb-1">עמלת עסקה ממוצעת</h4>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      אם אינך יודע בדיוק מה כל אמצעי גובה — הכנס ממוצע אחד לכל ההזמנות
                    </p>
                  </div>
                  <div className="flex items-center gap-3 max-w-xs">
                    <div className="relative flex-1">
                      <input type="number" step="0.1" min="0" max="20"
                        value={averageFeePercent}
                        onChange={e => setAverageFeePercent(parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, paddingLeft: '28px' }} dir="ltr" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>%</span>
                    </div>
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>מכל הזמנה</span>
                  </div>
                  <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))', color: 'var(--color-brand-start)' }}>
                    💡 טיפ: אם רוב ההזמנות הן Bit (3%) ואשראי (1.5%) — ממוצע של ~2% הוא הגיוני
                  </div>
                </div>
              ) : (
                /* Per payment method */
                <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                  <h4 className="text-white font-medium">אמצעי תשלום ועמלות</h4>
                  <div className="space-y-3">
                    {paymentMethods.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-4">
                        <label className="flex items-center gap-2 min-w-[140px] cursor-pointer">
                          <input type="checkbox" checked={m.enabled}
                            onChange={() => setPaymentMethods(prev => prev.map((p, j) => j === i ? { ...p, enabled: !p.enabled } : p))}
                            className="w-4 h-4 rounded accent-blue-500" />
                          <span className="text-sm" style={{ color: m.enabled ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{m.name}</span>
                        </label>
                        {m.enabled && (
                          <div className="relative">
                            <input type="number" step="0.1" min="0" value={m.feePercent}
                              onChange={e => setPaymentMethods(prev => prev.map((p, j) => j === i ? { ...p, feePercent: parseFloat(e.target.value) || 0 } : p))}
                              style={{ ...inputStyle, width: '96px', paddingLeft: '28px' }} dir="ltr" />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: AI Notes ── */}
          {step === 5 && (
            <div className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">הנחיות ל-AI</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>כתוב כאן כל כלל עסקי מיוחד שה-AI צריך לדעת בעת ניתוח הזמנות.</p>
              </div>

              <div className="rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))', border: '1px solid color-mix(in srgb, var(--color-brand-start) 35%, var(--color-bg-app))' }}>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-brand-start)' }}>💡 דוגמאות:</p>
                <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  <li>• "קפסולות הפתעה עולות לי $0.85 גם אם חינם ללקוח"</li>
                  <li>• "קופון 50₪ מצטבר עם הנחת כמות"</li>
                  <li>• "מוצר X הוא בעצם Y — עלות ₪12 לא ₪8"</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>הנחיות מיוחדות</label>
                <textarea
                  value={aiNotes}
                  onChange={e => setAiNotes(e.target.value)}
                  placeholder="כתוב כאן כל כלל עסקי מיוחד..."
                  rows={7}
                  style={{ ...inputStyle, resize: 'none', lineHeight: '1.6' }}
                />
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {aiNotes.length} תווים — ניתן לערוך בכל עת מדף ההגדרות
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', border: '1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-bg-app))' }}>
                <CheckCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--color-success)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
                  הכל מוכן! לחץ "סיים והתחל" כדי לעבור לדשבורד.
                </p>
              </div>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="flex items-center justify-between px-8 py-5"
            style={{ borderTop: '1px solid var(--color-border)' }}>
            <button onClick={prev} disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30 hover:opacity-80"
              style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
              <ChevronRight className="w-4 h-4" />
              הקודם
            </button>

            <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{step + 1} / {STEPS.length}</span>

            <button onClick={next}
              disabled={(step === 0 && !businessName.trim()) || saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 hover:-translate-y-0.5"
              style={{
                background: step === STEPS.length - 1
                  ? 'linear-gradient(135deg, var(--color-success), color-mix(in srgb, var(--color-success) 70%, black))'
                  : 'linear-gradient(135deg, var(--color-brand-start), var(--color-accent-indigo))',
              }}>
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" />שומר...</>
                : step === STEPS.length - 1
                  ? <><Rocket className="w-4 h-4" />סיים והתחל</>
                  : <>הבא <ChevronLeft className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
