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
  { id: 'general', label: 'כללי' },
  { id: 'costs', label: 'עלויות מוצרים' },
  { id: 'discounts', label: 'כללי הנחה' },
  { id: 'payment', label: 'תשלום ומע"מ' },
  { id: 'ai', label: 'הנחיות AI' },
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

        {tab === 'costs' && business && (
          <ProductCostsForm
            defaultValues={business.productCosts ?? DEFAULT_COSTS}
            onSave={async (data) => save({ productCosts: data }, 'costs')}
          />
        )}

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
