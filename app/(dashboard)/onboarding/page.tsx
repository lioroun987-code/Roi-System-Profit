'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ChevronLeft, ChevronRight, Store, DollarSign, Megaphone, CreditCard, Bot, Rocket, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/* ── Types ── */
interface ShopifyVariant { id: string; title: string; sku: string; price: string }
interface ShopifyProduct { id: string; title: string; image: string | null; variants: ShopifyVariant[] }
interface ProductCost { productId: string; variantId: string; title: string; variantTitle: string; costUsd: number }

const STEPS = [
  { id: 'welcome',  label: 'ברוך הבא',        icon: Rocket },
  { id: 'shopify',  label: 'חיבור Shopify',   icon: Store },
  { id: 'products', label: 'עלויות מוצרים',   icon: DollarSign },
  { id: 'ads',      label: 'חיבור פרסום',     icon: Megaphone },
  { id: 'payment',  label: 'תשלום ומע"מ',     icon: CreditCard },
  { id: 'ai',       label: 'הנחיות AI',        icon: Bot },
]

/* ── Step indicator ── */
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const done = i < current
        const active = i === current
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              active ? 'bg-blue-600 text-white' :
              done ? 'bg-emerald-100 text-emerald-700' :
              'bg-gray-100 text-gray-400'
            }`}>
              {done ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-0.5 ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main Wizard ── */
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)

  // Step 0 — Welcome
  const [businessName, setBusinessName] = useState('')

  // Step 1 — Shopify
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [shopifyToken, setShopifyToken] = useState('')
  const [shopifyConnecting, setShopifyConnecting] = useState(false)
  const [shopifyConnected, setShopifyConnected] = useState(false)
  const [shopifyError, setShopifyError] = useState('')

  // Step 2 — Products
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [productCosts, setProductCosts] = useState<Record<string, number>>({})
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(3.7)

  // Step 3 — Ads
  const [fbAdAccountId, setFbAdAccountId] = useState('')
  const [fbAccessToken, setFbAccessToken] = useState('')
  const [tiktokAdAccountId, setTiktokAdAccountId] = useState('')
  const [tiktokAccessToken, setTiktokAccessToken] = useState('')

  // Step 4 — Payment
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatPercent, setVatPercent] = useState(17)
  const [paymentMethods, setPaymentMethods] = useState([
    { name: 'Bit', feePercent: 3, enabled: true },
    { name: 'כרטיס אשראי', feePercent: 1, enabled: true },
    { name: 'PayPal', feePercent: 4.5, enabled: false },
    { name: 'Cash', feePercent: 0, enabled: false },
  ])

  // Step 5 — AI
  const [aiNotes, setAiNotes] = useState('')
  const [homeDeliveryCostUsd, setHomeDeliveryCostUsd] = useState(3)
  const [homeDeliveryChargeIls, setHomeDeliveryChargeIls] = useState(25)
  const [pickupFeeThresholdIls, setPickupFeeThresholdIls] = useState(200)
  const [pickupFeeAmountIls, setPickupFeeAmountIls] = useState(10)

  // Load businessId from localStorage
  useEffect(() => {
    const id = localStorage.getItem('activeBusiness')
    if (id) setBusinessId(id)
  }, [])

  /* ── Create business if not exists ── */
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

  /* ── Connect Shopify ── */
  async function connectShopify() {
    if (!shopifyDomain || !shopifyToken || !businessId) return
    setShopifyConnecting(true)
    setShopifyError('')
    try {
      const res = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopifyDomain, shopifyAccessToken: shopifyToken }),
      })
      if (res.ok) {
        setShopifyConnected(true)
        await fetchProducts(businessId)
      } else {
        setShopifyError('שגיאה בחיבור — בדוק דומיין וטוקן')
      }
    } finally { setShopifyConnecting(false) }
  }

  /* ── Fetch products ── */
  async function fetchProducts(bid: string) {
    setLoadingProducts(true)
    try {
      const res = await fetch(`/api/shopify/products?businessId=${bid}`)
      const data = await res.json()
      if (data.products) {
        setProducts(data.products)
        // Init costs to 0
        const initial: Record<string, number> = {}
        data.products.forEach((p: ShopifyProduct) =>
          p.variants.forEach(v => { initial[`${p.id}_${v.id}`] = 0 })
        )
        setProductCosts(initial)
      }
    } finally { setLoadingProducts(false) }
  }

  /* ── Save all & finish ── */
  async function finish() {
    if (!businessId) return
    setSaving(true)

    // Build product costs config
    const productCostsConfig: Record<string, number> = {}
    products.forEach(p => p.variants.forEach(v => {
      const key = `${p.id}_${v.id}`
      productCostsConfig[key] = productCosts[key] ?? 0
    }))

    const patches: Record<string, unknown> = {
      productCosts: {
        dealCost: 8.5,
        coolDealCost: 9.5,
        bottleCost: 6,
        singleCapsuleCost: 0.85,
        pack3Price: 69,
        pack7Price: 139,
        secondUnitDiscount: 2,
        homeDeliveryCostUsd,
        homeDeliveryChargeIls,
        pickupFeeThresholdIls,
        pickupFeeAmountIls,
        exchangeRate,
        customProductCosts: productCostsConfig,
      },
      paymentSettings: { vatEnabled, vatPercent, paymentMethods },
      aiNotes,
    }

    if (fbAdAccountId) patches.fbAdAccountId = fbAdAccountId
    if (fbAccessToken) patches.fbAccessToken = fbAccessToken

    await fetch(`/api/businesses/${businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patches),
    })

    setSaving(false)
    router.push('/dashboard')
  }

  /* ── Navigation ── */
  async function next() {
    if (step === 0) {
      if (!businessName.trim()) return
      const id = businessId ?? await createBusiness()
      if (!id) return
    }
    if (step === STEPS.length - 1) { finish(); return }
    setStep(s => s + 1)
  }

  function prev() { setStep(s => Math.max(0, s - 1)) }

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Rocket className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">רווחיות</span>
          </div>
        </div>

        <StepBar current={step} />

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-white text-2xl font-bold mb-2">ברוך הבא ל-רווחיות 👋</h2>
                <p className="text-gray-400">נגדיר את העסק שלך תוך 3 דקות. נתחיל עם הפרטים הבסיסיים.</p>
              </div>
              <div className="space-y-2">
                <Label>שם העסק / החנות</Label>
                <Input
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="חנות הקפסולות שלי"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>שער חליפין דולר–שקל</Label>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={e => setExchangeRate(parseFloat(e.target.value) || 3.7)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪/$</span>
                </div>
                <p className="text-gray-500 text-xs">כל החישובים יתבצעו לפי שער זה</p>
              </div>
            </div>
          )}

          {/* ── Step 1: Shopify ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-white text-2xl font-bold mb-2">חיבור Shopify</h2>
                <p className="text-gray-400">חבר את החנות שלך כדי שנמשוך מוצרים והזמנות אוטומטית.</p>
              </div>

              {shopifyConnected ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="text-emerald-400 font-medium">Shopify מחובר!</p>
                    <p className="text-gray-500 text-sm">{shopifyDomain} — משכנו {products.length} מוצרים</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>דומיין החנות</Label>
                    <Input
                      value={shopifyDomain}
                      onChange={e => setShopifyDomain(e.target.value)}
                      placeholder="your-store.myshopify.com"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Admin API Access Token</Label>
                    <Input
                      type="password"
                      value={shopifyToken}
                      onChange={e => setShopifyToken(e.target.value)}
                      placeholder="shpat_xxxx..."
                      dir="ltr"
                    />
                    <a
                      href="https://help.shopify.com/en/manual/apps/app-types/custom-apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 text-xs hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      איך מקבלים Access Token?
                    </a>
                  </div>
                  {shopifyError && (
                    <p className="text-red-400 text-sm">{shopifyError}</p>
                  )}
                  <Button onClick={connectShopify} loading={shopifyConnecting} className="w-full">
                    חבר את Shopify ומשוך מוצרים
                  </Button>
                </>
              )}

              <div className="border-t border-white/10 pt-4">
                <p className="text-gray-500 text-sm text-center">
                  אין לך Shopify עדיין?{' '}
                  <button onClick={() => setStep(s => s + 1)} className="text-blue-400 hover:underline">
                    דלג לשלב הבא
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Product Costs ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-white text-2xl font-bold mb-2">עלויות מוצרים</h2>
                <p className="text-gray-400">
                  הכנס את העלות שאתה משלם לכל מוצר. זה ישמש לחישוב הרווח הנקי.
                </p>
              </div>

              {loadingProducts ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <span className="text-gray-400">טוען מוצרים מ-Shopify...</span>
                </div>
              ) : products.length > 0 ? (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pl-1">
                  {products.map(product => (
                    <div key={product.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                        {product.image ? (
                          <img src={product.image} alt={product.title} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                            <Store className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <h4 className="text-white font-medium text-sm">{product.title}</h4>
                      </div>
                      <div className="divide-y divide-white/5">
                        {product.variants.map(variant => {
                          const key = `${product.id}_${variant.id}`
                          return (
                            <div key={variant.id} className="flex items-center justify-between px-4 py-3">
                              <div>
                                <p className="text-gray-300 text-sm">
                                  {variant.title === 'Default Title' ? 'מוצר בודד' : variant.title}
                                </p>
                                {variant.sku && <p className="text-gray-600 text-xs">SKU: {variant.sku}</p>}
                                <p className="text-gray-500 text-xs">מחיר מכירה: ₪{variant.price}</p>
                              </div>
                              <div className="relative w-32">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={productCosts[key] || ''}
                                  onChange={e => setProductCosts(prev => ({
                                    ...prev,
                                    [key]: parseFloat(e.target.value) || 0,
                                  }))}
                                  className="text-left pl-7 pr-2 h-9"
                                  dir="ltr"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>לא נמצאו מוצרים — חבר Shopify בשלב הקודם</p>
                  <p className="text-xs mt-2">או הגדר עלויות ידנית בהגדרות לאחר מכן</p>
                </div>
              )}

              <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">עלות משלוח לבית ($)</Label>
                  <div className="relative">
                    <Input type="number" step="0.01" value={homeDeliveryCostUsd} onChange={e => setHomeDeliveryCostUsd(parseFloat(e.target.value) || 0)} className="h-9" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">חיוב משלוח ללקוח (₪)</Label>
                  <div className="relative">
                    <Input type="number" value={homeDeliveryChargeIls} onChange={e => setHomeDeliveryChargeIls(parseFloat(e.target.value) || 0)} className="h-9" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₪</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Ads ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-white text-2xl font-bold mb-2">חיבור פרסום</h2>
                <p className="text-gray-400">חבר את פלטפורמות הפרסום שלך כדי לחשב ROAS אמיתי על בסיס רווח.</p>
              </div>

              {/* Facebook */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center">
                    <span className="text-blue-400 font-bold text-sm">f</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Facebook / Meta Ads</h4>
                    <p className="text-gray-500 text-xs">משוך הוצאות יומיות אוטומטית</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ad Account ID</Label>
                    <Input value={fbAdAccountId} onChange={e => setFbAdAccountId(e.target.value)} placeholder="123456789" dir="ltr" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Access Token</Label>
                    <Input type="password" value={fbAccessToken} onChange={e => setFbAccessToken(e.target.value)} placeholder="EAAx..." dir="ltr" className="h-9" />
                  </div>
                </div>
              </div>

              {/* TikTok */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-pink-600/20 flex items-center justify-center">
                    <span className="text-pink-400 font-bold text-sm">T</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">TikTok Ads</h4>
                    <p className="text-gray-500 text-xs">בקרוב — בשלב ה-Beta</p>
                  </div>
                  <span className="mr-auto text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">בקרוב</span>
                </div>
                <div className="grid gap-3 opacity-50 pointer-events-none">
                  <Input placeholder="Ad Account ID" dir="ltr" className="h-9" disabled />
                  <Input placeholder="Access Token" dir="ltr" className="h-9" disabled />
                </div>
              </div>

              <p className="text-gray-500 text-sm text-center">
                ניתן לדלג ולחבר מאוחר יותר מדף האינטגרציות
              </p>
            </div>
          )}

          {/* ── Step 4: Payment ── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-white text-2xl font-bold mb-2">הגדרות תשלום ומע"מ</h2>
                <p className="text-gray-400">הגדר אמצעי תשלום ועמלות — אלה יורדו מהרווח אוטומטית.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                <h4 className="text-white font-medium">מע"מ</h4>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={vatEnabled} onChange={e => setVatEnabled(e.target.checked)} className="w-4 h-4" />
                  <span className="text-gray-300 text-sm">העסק גובה מע"מ</span>
                </label>
                {vatEnabled && (
                  <div className="relative max-w-xs mr-7">
                    <Input type="number" value={vatPercent} onChange={e => setVatPercent(parseFloat(e.target.value) || 17)} className="h-9" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                <h4 className="text-white font-medium">אמצעי תשלום ועמלות</h4>
                <div className="space-y-3">
                  {paymentMethods.map((m, i) => (
                    <div key={m.name} className="flex items-center gap-4">
                      <label className="flex items-center gap-2 w-36 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={() => setPaymentMethods(prev => prev.map((p, j) => j === i ? { ...p, enabled: !p.enabled } : p))}
                          className="w-4 h-4"
                        />
                        <span className="text-gray-300 text-sm">{m.name}</span>
                      </label>
                      {m.enabled && (
                        <div className="relative max-w-xs">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={m.feePercent}
                            onChange={e => setPaymentMethods(prev => prev.map((p, j) => j === i ? { ...p, feePercent: parseFloat(e.target.value) || 0 } : p))}
                            className="h-9 max-w-24"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: AI Notes ── */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-white text-2xl font-bold mb-2">הנחיות לבינה המלאכותית</h2>
                <p className="text-gray-400">
                  כתוב כאן כל כלל עסקי מיוחד, מקרה קצה, או משהו שלא ניתן להסביר דרך הממשק הרגיל.
                  ה-AI יקרא את זה עם כל ניתוח הזמנה.
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-300 text-sm font-medium mb-2">💡 דוגמאות למה לכתוב:</p>
                <ul className="space-y-1 text-gray-400 text-sm">
                  <li>• "כשקונים 2 דילים עם 10% הנחה, ההנחה מחליפה הנחת כמות — אין כפל"</li>
                  <li>• "קפסולות הפתעה עולות לי 0.85$ כל אחת גם אם חינם ללקוח"</li>
                  <li>• "קופון 50₪ תמיד מצטבר עם הנחת כמות"</li>
                  <li>• "מוצר X הוא בעצם Y — עלות ₪12 לא ₪8"</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label>הנחיות מיוחדות (עברית מועדפת)</Label>
                <Textarea
                  value={aiNotes}
                  onChange={e => setAiNotes(e.target.value)}
                  placeholder="כתוב כאן כל כלל עסקי מיוחד שה-AI צריך לדעת..."
                  rows={8}
                  className="min-h-48 resize-none"
                />
                <p className="text-gray-500 text-xs">
                  {aiNotes.length} תווים — אפשר להוסיף ולערוך בכל עת מדף ההגדרות
                </p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-400 text-sm">
                ✓ הכל מוכן! לחץ על "סיים והתחל" כדי להיכנס לדשבורד.
              </div>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={prev}
              disabled={step === 0}
              className="flex items-center gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              הקודם
            </Button>

            <span className="text-gray-500 text-sm">{step + 1} / {STEPS.length}</span>

            <Button
              onClick={next}
              loading={saving}
              disabled={step === 0 && !businessName.trim()}
              className="flex items-center gap-2"
            >
              {step === STEPS.length - 1 ? (
                <>
                  <Rocket className="w-4 h-4" />
                  סיים והתחל
                </>
              ) : (
                <>
                  הבא
                  <ChevronLeft className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
