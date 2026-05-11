'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Business {
  id: string
  name: string
  shopifyDomain: string | null
  shopifyAccessToken: string | null
  fbAdAccountId: string | null
  fbAccessToken: string | null
  googleSheetsId: string | null
  googleRefreshToken: string | null
}

export default function IntegrationsPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncingFb, setSyncingFb] = useState(false)

  const [shopifyDomain, setShopifyDomain] = useState('')
  const [shopifyToken, setShopifyToken] = useState('')
  const [shopifyWebhookSecret, setShopifyWebhookSecret] = useState('')
  const [fbAdAccountId, setFbAdAccountId] = useState('')
  const [fbAccessToken, setFbAccessToken] = useState('')
  const [sheetsId, setSheetsId] = useState('')

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
    const data: Business = await res.json()
    setBusiness(data)
    setShopifyDomain(data.shopifyDomain ?? '')
    setFbAdAccountId(data.fbAdAccountId ?? '')
    setSheetsId(data.googleSheetsId ?? '')
  }, [activeBusiness])

  useEffect(() => { fetchBusiness() }, [fetchBusiness])

  async function saveShopify() {
    if (!activeBusiness) return
    setSaving(true)
    await fetch(`/api/businesses/${activeBusiness}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopifyDomain,
        shopifyAccessToken: shopifyToken || undefined,
        shopifyWebhookSecret: shopifyWebhookSecret || undefined,
      }),
    })
    setSaving(false)
    fetchBusiness()
  }

  async function saveFacebook() {
    if (!activeBusiness) return
    setSaving(true)
    await fetch(`/api/businesses/${activeBusiness}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fbAdAccountId,
        fbAccessToken: fbAccessToken || undefined,
      }),
    })
    setSaving(false)
    fetchBusiness()
  }

  async function saveSheets() {
    if (!activeBusiness) return
    setSaving(true)
    await fetch(`/api/businesses/${activeBusiness}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleSheetsId: sheetsId }),
    })
    setSaving(false)
    fetchBusiness()
  }

  async function syncFacebook() {
    if (!activeBusiness) return
    setSyncingFb(true)
    const today = new Date().toISOString().split('T')[0]
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const res = await fetch('/api/facebook/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness, dateFrom: thirtyAgo, dateTo: today }),
    })
    const data = await res.json()
    setSyncingFb(false)
    alert(data.error ? `שגיאה: ${data.error}` : `סנכרנו ${data.synced} ימים`)
  }

  const connected = (val: string | null | undefined) => val && val.trim() !== ''

  if (!activeBusiness) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>בחר עסק כדי לנהל אינטגרציות</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">אינטגרציות</h1>

      <IntegrationCard
        title="Shopify"
        description="חבר את חנות ה-Shopify שלך לקבלת הזמנות אוטומטית"
        connected={!!(connected(business?.shopifyDomain) && connected(business?.shopifyAccessToken))}
      >
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>דומיין החנות</Label>
            <Input
              value={shopifyDomain}
              onChange={e => setShopifyDomain(e.target.value)}
              placeholder="your-store.myshopify.com"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Access Token</Label>
            <Input
              type="password"
              value={shopifyToken}
              onChange={e => setShopifyToken(e.target.value)}
              placeholder="shpat_xxxx..."
              dir="ltr"
            />
            <p className="text-gray-500 text-xs">השאר ריק כדי לשמור את הקיים</p>
          </div>
          <div className="space-y-1.5">
            <Label>Webhook Secret (אופציונלי)</Label>
            <Input
              type="password"
              value={shopifyWebhookSecret}
              onChange={e => setShopifyWebhookSecret(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input
              value={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/api/shopify/webhook`}
              readOnly
              dir="ltr"
              className="opacity-60"
            />
            <p className="text-gray-500 text-xs">העתק URL זה לשדה Webhook בהגדרות Shopify, עבור האירוע orders/create</p>
          </div>
          <Button onClick={saveShopify} loading={saving} className="w-fit">
            שמור הגדרות Shopify
          </Button>
        </div>
      </IntegrationCard>

      <IntegrationCard
        title="Facebook Ads"
        description="משוך נתוני הוצאות פרסום יומיות מ-Facebook"
        connected={!!(connected(business?.fbAdAccountId) && connected(business?.fbAccessToken))}
      >
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Ad Account ID</Label>
            <Input
              value={fbAdAccountId}
              onChange={e => setFbAdAccountId(e.target.value)}
              placeholder="123456789"
              dir="ltr"
            />
            <p className="text-gray-500 text-xs">ה-ID ללא act_ (בלי הקידומת)</p>
          </div>
          <div className="space-y-1.5">
            <Label>Access Token</Label>
            <Input
              type="password"
              value={fbAccessToken}
              onChange={e => setFbAccessToken(e.target.value)}
              placeholder="EAAx..."
              dir="ltr"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveFacebook} loading={saving} className="w-fit">
              שמור
            </Button>
            {connected(business?.fbAdAccountId) && (
              <Button variant="outline" onClick={syncFacebook} loading={syncingFb}>
                <RefreshCw className="w-4 h-4" />
                סנכרן נתונים (30 יום)
              </Button>
            )}
          </div>
        </div>
      </IntegrationCard>

      <IntegrationCard
        title="Google Sheets"
        description="ייצא הזמנות ונתוני רווח לגיליון Google"
        connected={!!(connected(business?.googleSheetsId) && connected(business?.googleRefreshToken))}
      >
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Spreadsheet ID</Label>
            <Input
              value={sheetsId}
              onChange={e => setSheetsId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              dir="ltr"
            />
            <p className="text-gray-500 text-xs">ה-ID מתוך כתובת ה-URL של הגיליון</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSheets} loading={saving} className="w-fit">
              שמור מזהה גיליון
            </Button>
            {activeBusiness && (
              <Button
                variant="outline"
                onClick={() => window.location.href = `/api/sheets/auth?businessId=${activeBusiness}`}
              >
                <ExternalLink className="w-4 h-4" />
                אשר גישה ל-Google
              </Button>
            )}
          </div>
        </div>
      </IntegrationCard>
    </div>
  )
}

function IntegrationCard({
  title,
  description,
  connected,
  children,
}: {
  title: string
  description: string
  connected: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors text-right"
      >
        <div className="flex items-center gap-3">
          {connected ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-500" />
          )}
          <div>
            <h3 className="text-white font-medium">{title}</h3>
            <p className="text-gray-500 text-sm">{description}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {connected ? 'מחובר' : 'לא מחובר'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-6">
          {children}
        </div>
      )}
    </div>
  )
}
