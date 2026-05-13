'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle, RefreshCw, ExternalLink, Store, BarChart2, Sheet, ChevronDown, Zap } from 'lucide-react'

interface Business {
  id: string; name: string
  shopifyDomain: string | null; shopifyAccessToken: string | null
  fbAdAccountId: string | null; fbAccessToken: string | null
  googleSheetsId: string | null; googleRefreshToken: string | null
}

const cardStyle = { background: '#13161F', borderColor: '#1E2130' }

function IntegrationCard({ title, subtitle, icon, connected, status, children }: {
  title: string; subtitle: string; icon: React.ReactNode
  connected: boolean; status?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-5 text-right transition-colors"
        style={{ background: open ? '#181B27' : 'transparent' }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1E2130' }}>
          {icon}
        </div>
        <div className="flex-1 text-right">
          <h3 className="text-white font-semibold">{title}</h3>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full font-medium" style={{
            background: connected ? '#0D2818' : '#1A1D2A',
            color: connected ? '#22C55E' : '#6B7280',
          }}>
            {connected ? '✓ מחובר' : status ?? 'לא מחובר'}
          </span>
          <ChevronDown className="w-4 h-4 transition-transform" style={{ color: '#4A5174', transform: open ? 'rotate(180deg)' : 'none' }} />
        </div>
      </button>
      {open && (
        <div className="border-t px-5 py-5 space-y-4" style={{ borderColor: '#1E2130', background: '#0F1119' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function ConnectButton({ href, label, icon, variant = 'primary' }: { href: string; label: string; icon?: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
      style={variant === 'primary'
        ? { background: 'linear-gradient(135deg, #4F6EF7, #7C5CFC)', color: 'white' }
        : { background: '#1E2130', color: '#CBD5E1', border: '1px solid #2A2D3E' }
      }
    >
      {icon}
      {label}
    </a>
  )
}

export default function IntegrationsPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncingSheets, setSyncingSheets] = useState(false)
  const [syncResult, setSyncResult] = useState<{ processed: number; skipped: number; errors: number } | null>(null)
  const [sheetsId, setSheetsId] = useState('')
  const [savingSheets, setSavingSheets] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const stored = localStorage.getItem('activeBusiness')
    if (stored) setActiveBusiness(stored)
    const handler = (e: CustomEvent) => setActiveBusiness(e.detail)
    window.addEventListener('businessChange', handler as EventListener)
    return () => window.removeEventListener('businessChange', handler as EventListener)
  }, [])

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected === 'shopify') showToast('Shopify חובר בהצלחה! 🎉', 'success')
    if (connected === 'facebook') showToast('Facebook Ads חובר בהצלחה! 🎉', 'success')
    if (connected === 'sheets') showToast('Google Sheets חובר בהצלחה! 🎉', 'success')
    if (error === 'shopify') showToast('שגיאה בחיבור Shopify', 'error')
    if (error === 'facebook') showToast('שגיאה בחיבור Facebook', 'error')
  }, [searchParams])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchBusiness = useCallback(async () => {
    if (!activeBusiness) return
    const res = await fetch(`/api/businesses/${activeBusiness}`)
    const data = await res.json()
    setBusiness(data)
    setSheetsId(data.googleSheetsId ?? '')
  }, [activeBusiness])

  useEffect(() => { fetchBusiness() }, [fetchBusiness])

  async function syncFacebook() {
    if (!activeBusiness) return
    setSyncing(true)
    const today = new Date().toISOString().split('T')[0]
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const res = await fetch('/api/facebook/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness, dateFrom: thirtyAgo, dateTo: today }),
    })
    const data = await res.json()
    setSyncing(false)
    showToast(data.error ? `שגיאה: ${data.error}` : `סנכרנו נתוני ${data.synced} ימים`, data.error ? 'error' : 'success')
  }

  async function syncFromSheet() {
    if (!activeBusiness) return
    setSyncingSheets(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sheets/sync-from-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: activeBusiness }),
      })
      const data = await res.json()
      if (data.error) {
        showToast(`שגיאה: ${data.error}`, 'error')
      } else {
        setSyncResult({ processed: data.processed, skipped: data.skipped, errors: data.errors })
        showToast(data.message, 'success')
      }
    } catch {
      showToast('שגיאת חיבור', 'error')
    } finally {
      setSyncingSheets(false)
    }
  }

  async function saveSheets() {
    if (!activeBusiness) return
    setSavingSheets(true)
    await fetch(`/api/businesses/${activeBusiness}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleSheetsId: sheetsId }),
    })
    setSavingSheets(false)
    fetchBusiness()
    showToast('מזהה הגיליון נשמר', 'success')
  }

  const inputStyle = {
    background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1',
    borderRadius: '10px', padding: '10px 14px', fontSize: '13px',
    outline: 'none', width: '100%', direction: 'ltr' as const,
  }

  if (!activeBusiness) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p style={{ color: '#4A5174' }}>בחר עסק מהתפריט הצדדי</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium" style={{ background: toast.type === 'success' ? '#0D2818' : '#2D0F0F', border: `1px solid ${toast.type === 'success' ? '#22C55E40' : '#EF444440'}` }}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-white">אינטגרציות</h1>
        <p className="text-sm mt-0.5" style={{ color: '#4A5174' }}>חבר את הכלים שלך לקבלת נתונים אוטומטית</p>
      </div>

      {/* Shopify */}
      <IntegrationCard
        title="Shopify"
        subtitle="חיבור חנות לקבלת הזמנות אוטומטית בזמן אמת"
        icon={<Store className="w-5 h-5" style={{ color: '#95BF47' }} />}
        connected={!!(business?.shopifyDomain && business?.shopifyAccessToken)}
      >
        {business?.shopifyDomain && business?.shopifyAccessToken ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#0D2818', border: '1px solid #22C55E30' }}>
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-emerald-400 font-medium text-sm">מחובר בהצלחה</p>
                <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>{business.shopifyDomain}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ConnectButton
                href={`/api/shopify/auth?businessId=${activeBusiness}&shop=${business.shopifyDomain}`}
                label="חבר מחדש"
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
              />
              <a href="/orders" className="text-sm font-medium" style={{ color: '#4F6EF7' }}>
                צפה בהזמנות ←
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#8B8FA8' }}>
              הכנס את כתובת החנות שלך ונפנה אותך לאישור בשופיפיי. לא נדרש API key ידני.
            </p>
            <ShopifyConnectForm businessId={activeBusiness} onConnected={fetchBusiness} />
          </div>
        )}
      </IntegrationCard>

      {/* Facebook */}
      <IntegrationCard
        title="Facebook & Meta Ads"
        subtitle="סנכרון הוצאות פרסום יומיות לחישוב ROAS אמיתי"
        icon={<span className="text-blue-500 font-bold text-lg">f</span>}
        connected={!!(business?.fbAdAccountId && business?.fbAccessToken)}
      >
        {business?.fbAdAccountId && business?.fbAccessToken ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#0D2818', border: '1px solid #22C55E30' }}>
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-emerald-400 font-medium text-sm">מחובר בהצלחה</p>
                <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>Ad Account: {business.fbAdAccountId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={syncFacebook}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: '#1E2130', color: '#CBD5E1' }}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'מסנכרן...' : 'סנכרן 30 ימים'}
              </button>
              <ConnectButton
                href={`/api/facebook/auth?businessId=${activeBusiness}`}
                label="חבר מחדש"
                variant="secondary"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#8B8FA8' }}>
              לחץ על הכפתור ותועבר לאישור גישה ב-Facebook. לאחר האישור נשמור את הטוקן אוטומטית.
            </p>
            <ConnectButton
              href={`/api/facebook/auth?businessId=${activeBusiness}`}
              label="התחבר עם Facebook"
              icon={<span className="font-bold">f</span>}
            />
            <p className="text-xs" style={{ color: '#4A5174' }}>
              נדרשות הרשאות: ads_read, business_management
            </p>
          </div>
        )}
      </IntegrationCard>

      {/* Google Sheets */}
      <IntegrationCard
        title="Google Sheets"
        subtitle="ייצוא אוטומטי של הזמנות ורווחים לגיליון"
        icon={<Sheet className="w-5 h-5" style={{ color: '#34A853' }} />}
        connected={!!(business?.googleSheetsId && business?.googleRefreshToken)}
      >
        {business?.googleRefreshToken ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#0D2818', border: '1px solid #22C55E30' }}>
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-emerald-400 font-medium text-sm">Google מחובר</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm" style={{ color: '#8B8FA8' }}>מזהה הגיליון (מתוך ה-URL)</label>
              <div className="flex gap-2">
                <input
                  value={sheetsId}
                  onChange={e => setSheetsId(e.target.value)}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  style={inputStyle}
                />
                <button
                  onClick={saveSheets}
                  disabled={savingSheets}
                  className="px-4 py-2 rounded-xl text-sm font-medium shrink-0 text-white"
                  style={{ background: '#4F6EF7' }}
                >
                  {savingSheets ? '...' : 'שמור'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#8B8FA8' }}>
              לחץ לאישור גישה ב-Google. לאחר האישור תוכל לייצא הזמנות לכל גיליון שתבחר.
            </p>
            <ConnectButton
              href={`/api/sheets/auth?businessId=${activeBusiness}`}
              label="התחבר עם Google"
              icon={<ExternalLink className="w-4 h-4" />}
            />
          </div>
        )}
      </IntegrationCard>

      {/* Webhook info */}
      <div className="rounded-2xl border p-5" style={cardStyle}>
        <h3 className="text-white font-semibold mb-2">Shopify Webhook URL</h3>
        <p className="text-sm mb-3" style={{ color: '#6B7280' }}>
          אם חיברת Shopify ידנית, הוסף Webhook זה בהגדרות Shopify עבור האירוע <code className="text-blue-400">orders/create</code>
        </p>
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#0D0F14', border: '1px solid #1E2130' }}>
          <code className="text-sm text-emerald-400 flex-1 text-left" dir="ltr">
            {process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.vercel.app'}/api/shopify/webhook
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/shopify/webhook`)}
            className="text-xs px-3 py-1.5 rounded-lg shrink-0"
            style={{ background: '#1E2130', color: '#8B8FA8' }}
          >
            העתק
          </button>
        </div>
      </div>
    </div>
  )
}

function ShopifyConnectForm({ businessId, onConnected }: { businessId: string; onConnected: () => void }) {
  const [shop, setShop] = useState('')

  const inputStyle = {
    background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1',
    borderRadius: '10px', padding: '10px 14px', fontSize: '13px',
    outline: 'none', width: '100%', direction: 'ltr' as const,
  }

  const shopDomain = shop.includes('.') ? shop : shop ? `${shop}.myshopify.com` : ''

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-sm" style={{ color: '#8B8FA8' }}>כתובת החנות</label>
        <div className="flex gap-2 items-center">
          <input
            value={shop}
            onChange={e => setShop(e.target.value.replace('https://', '').replace('http://', ''))}
            placeholder="my-store.myshopify.com"
            style={inputStyle}
          />
        </div>
        {shopDomain && (
          <p className="text-xs" style={{ color: '#4A5174' }}>יתחבר ל: {shopDomain}</p>
        )}
      </div>
      <a
        href={shopDomain ? `/api/shopify/auth?businessId=${businessId}&shop=${shopDomain}` : '#'}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${!shopDomain ? 'opacity-50 pointer-events-none' : 'hover:-translate-y-0.5'}`}
        style={{ background: !shopDomain ? '#4F6EF7' : 'linear-gradient(135deg, #4F6EF7, #7C5CFC)' }}
      >
        <Store className="w-4 h-4" />
        חבר את Shopify
      </a>
      <p className="text-xs" style={{ color: '#4A5174' }}>
        תועבר לשופיפיי לאישור הגישה — בטוח ומאובטח
      </p>
    </div>
  )
}
