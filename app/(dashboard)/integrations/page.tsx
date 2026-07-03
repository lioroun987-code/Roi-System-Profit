'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle, RefreshCw, ExternalLink, Store, Sheet, ChevronDown, Zap } from 'lucide-react'

interface Business {
  id: string; name: string
  shopifyDomain: string | null; shopifyAccessToken: string | null
  fbAdAccountId: string | null; fbAccessToken: string | null
  googleSheetsId: string | null; googleRefreshToken: string | null
}

const cardStyle = { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }

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
        style={{ background: open ? 'var(--color-bg-surface-alt)' : 'transparent' }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-border)' }}>
          {icon}
        </div>
        <div className="flex-1 text-right">
          <h3 className="text-white font-semibold">{title}</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full font-medium" style={{
            background: connected ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))' : 'var(--color-bg-surface-alt)',
            color: connected ? 'var(--color-success)' : 'var(--color-text-secondary)',
          }}>
            {connected ? '✓ מחובר' : status ?? 'לא מחובר'}
          </span>
          <ChevronDown className="w-4 h-4 transition-transform" style={{ color: 'var(--color-text-tertiary)', transform: open ? 'rotate(180deg)' : 'none' }} />
        </div>
      </button>
      {open && (
        <div className="border-t px-5 py-5 space-y-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-app)' }}>
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
        ? { background: 'linear-gradient(135deg, var(--color-brand-start), var(--color-brand-end))', color: 'white' }
        : { background: 'var(--color-border)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-subtle)' }
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
  // Reconcile
  const [agentSheetId, setAgentSheetId] = useState('')
  const [agentSheetName, setAgentSheetName] = useState('')
  const [reconciling, setReconciling] = useState(false)
  const [reconcileResult, setReconcileResult] = useState<{
    summary: { total: number; matches: number; agentHigher: number; weHigher: number; missingCost: number }
    results: Array<{ orderNumber: string; agentCost: number; ourCost: number | null; diff: number; status: string }>
  } | null>(null)
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

  async function runReconcile() {
    if (!activeBusiness || !agentSheetId) return
    setReconciling(true)
    setReconcileResult(null)
    try {
      const res = await fetch('/api/sheets/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: activeBusiness, agentSheetId, agentSheetName: agentSheetName || undefined }),
      })
      const data = await res.json()
      if (data.error) showToast(`שגיאה: ${data.error}`, 'error')
      else {
        setReconcileResult(data)
        showToast(`הושלם — ${data.summary.matches} תואמים, ${data.summary.agentHigher + data.summary.weHigher} פערים`, 'success')
      }
    } catch { showToast('שגיאת חיבור', 'error') }
    finally { setReconciling(false) }
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

  async function disconnect(fields: Record<string, null>) {
    if (!activeBusiness) return
    await fetch(`/api/businesses/${activeBusiness}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    fetchBusiness()
    showToast('הניתוק בוצע בהצלחה', 'success')
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
    background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
    borderRadius: '10px', padding: '10px 14px', fontSize: '13px',
    outline: 'none', width: '100%', direction: 'ltr' as const,
  }

  if (!activeBusiness) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p style={{ color: 'var(--color-text-tertiary)' }}>בחר עסק מהתפריט הצדדי</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium" style={{ background: toast.type === 'success' ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))' : 'color-mix(in srgb, var(--color-danger) 20%, var(--color-bg-app))', border: `1px solid ${toast.type === 'success' ? 'color-mix(in srgb, var(--color-success) 40%, transparent)' : 'color-mix(in srgb, var(--color-danger) 40%, transparent)'}` }}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-[var(--color-success)]" /> : <AlertCircle className="w-4 h-4 text-[var(--color-danger)]" />}
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-white">אינטגרציות</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>חבר את הכלים שלך לקבלת נתונים אוטומטית</p>
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
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0" />
                <div>
                  <p className="text-[var(--color-success)] font-medium text-sm">מחובר בהצלחה</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{business.shopifyDomain}</p>
                </div>
              </div>
              <button
                onClick={() => { if (confirm('לנתק את Shopify?')) disconnect({ shopifyDomain: null, shopifyAccessToken: null, shopifyWebhookSecret: null }) }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 20%, var(--color-bg-app))', color: 'var(--color-danger)' }}
              >
                נתק
              </button>
            </div>
            <div className="flex items-center gap-3">
              <ConnectButton
                href={`/api/shopify/auth?businessId=${activeBusiness}&shop=${business.shopifyDomain}`}
                label="חבר מחדש"
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
              />
              <a href="/orders" className="text-sm font-medium" style={{ color: 'var(--color-brand-start)' }}>
                צפה בהזמנות ←
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
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
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0" />
                <div>
                  <p className="text-[var(--color-success)] font-medium text-sm">מחובר בהצלחה</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Ad Account: {business.fbAdAccountId}</p>
                </div>
              </div>
              <button
                onClick={() => { if (confirm('לנתק את Facebook Ads?')) disconnect({ fbAdAccountId: null, fbAccessToken: null }) }}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 20%, var(--color-bg-app))', color: 'var(--color-danger)' }}
              >
                נתק
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={syncFacebook}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'var(--color-border)', color: 'var(--color-text-primary)' }}
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
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              לחץ על הכפתור ותועבר לאישור גישה ב-Facebook. לאחר האישור נשמור את הטוקן אוטומטית.
            </p>
            <ConnectButton
              href={`/api/facebook/auth?businessId=${activeBusiness}`}
              label="התחבר עם Facebook"
              icon={<span className="font-bold">f</span>}
            />
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
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
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))', border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0" />
                <p className="text-[var(--color-success)] font-medium text-sm">Google מחובר</p>
              </div>
              <button
                onClick={() => { if (confirm('לנתק את Google Sheets?')) disconnect({ googleRefreshToken: null, googleAccessToken: null }) }}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 20%, var(--color-bg-app))', color: 'var(--color-danger)' }}
              >
                נתק
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>מזהה הגיליון (מתוך ה-URL)</label>
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
                  style={{ background: 'var(--color-brand-start)' }}
                >
                  {savingSheets ? '...' : 'שמור'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
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

      {/* Sheet Sync — The main feature */}
      {business?.googleRefreshToken && business?.googleSheetsId && (
        <div className="rounded-2xl border p-6" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 15%, var(--color-bg-app))', borderColor: 'color-mix(in srgb, var(--color-brand-start) 35%, var(--color-bg-app))' }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 35%, var(--color-bg-app))' }}>
              <Zap className="w-6 h-6 text-[var(--color-brand-start)]" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-lg mb-1">סנכרון אוטומטי מהגיליון</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                המערכת תסרוק את הגיליון שלך, תזהה הזמנות שטרם חושב עבורן מחיר (עמודה G ריקה),
                תמשוך את פרטיהן משופיפיי, תחשב עם AI את העלות האמיתית — ותמלא אוטומטית עמודות G ו-H.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                {[
                  { step: '1', label: 'קורא את הגיליון', desc: 'מוצא שורות עם עמודה G ריקה' },
                  { step: '2', label: 'מושך מ-Shopify', desc: 'מאתר את ההזמנה לפי מספר' },
                  { step: '3', label: 'AI מחשב ומעדכן', desc: 'ממלא עלות ורווח אוטומטית' },
                ].map(s => (
                  <div key={s.step} className="p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))' }}>
                    <div className="w-7 h-7 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--color-brand-start)' }}>{s.step}</div>
                    <p className="text-white text-xs font-semibold">{s.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{s.desc}</p>
                  </div>
                ))}
              </div>

              {syncResult && (
                <div className="flex gap-4 mb-4 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))' }}>
                  <div className="text-center">
                    <p className="text-[var(--color-success)] font-bold text-xl">{syncResult.processed}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>עודכנו</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[var(--color-text-secondary)] font-bold text-xl">{syncResult.skipped}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>דולגו</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[var(--color-danger)] font-bold text-xl">{syncResult.errors}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>שגיאות</p>
                  </div>
                </div>
              )}

              <button
                onClick={syncFromSheet}
                disabled={syncingSheets}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                style={{ background: syncingSheets ? 'var(--color-border)' : 'linear-gradient(135deg, var(--color-brand-start), var(--color-brand-end))' }}
              >
                <RefreshCw className={`w-4 h-4 ${syncingSheets ? 'animate-spin' : ''}`} />
                {syncingSheets ? 'מחשב ומעדכן את הגיליון...' : 'סנכרן והשלם עלויות בגיליון'}
              </button>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                רק שורות עם עמודה G ריקה יעובדו. שורות קיימות לא יידרסו.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reconcile — Agent sheet comparison */}
      <div className="rounded-2xl border p-6" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, var(--color-bg-app))', borderColor: 'color-mix(in srgb, var(--color-success) 35%, var(--color-bg-app))' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-success) 35%, var(--color-bg-app))' }}>
            <span className="text-2xl">🔍</span>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-1">בדיקת פערים מול גיליון הסוכן</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
              הכנס את מזהה הגיליון של הסוכן. המערכת תחשב את עלות כל הזמנה (K+L+M) ותשווה מול העלות שחישבנו (עמודה G שלך). פערים יסומנו אוטומטית בעמודה I בגיליון שלך.
            </p>

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { emoji: '📊', label: 'קורא גיליון סוכן', desc: 'K (מחיר) + L (הנחה) + M (משלוח) לפי מספר הזמנה' },
                { emoji: '⚖️', label: 'משווה עלויות', desc: 'מול עמודה G בגיליון שלך' },
                { emoji: '🚨', label: 'מסמן פערים', desc: 'כותב סטטוס בעמודה I: תואם / פער + סכום' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, var(--color-bg-app))' }}>
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <p className="text-white text-xs font-semibold">{s.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Inputs */}
            <div className="grid gap-3 mb-4">
              <div className="space-y-1.5">
                <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>מזהה גיליון הסוכן</label>
                <input
                  value={agentSheetId}
                  onChange={e => setAgentSheetId(e.target.value.trim())}
                  placeholder="1GpfYvjo3KGUuCuwZRE8fs_JZmYUx1AtkOoB-RkktISA"
                  style={{ background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none', width: '100%', direction: 'ltr' }}
                />
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  מתוך URL הגיליון: docs.google.com/spreadsheets/d/<strong style={{ color: 'var(--color-success)' }}>ID_כאן</strong>/edit
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>שם הגיליון (טאב) — אופציונלי</label>
                <input
                  value={agentSheetName}
                  onChange={e => setAgentSheetName(e.target.value)}
                  placeholder="הזמנות 01/01 - 31/01"
                  style={{ background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none', width: '100%' }}
                />
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>השאר ריק לשימוש בגיליון הראשון</p>
              </div>
            </div>

            {/* Results summary */}
            {reconcileResult && (
              <div className="mb-4 rounded-xl p-4 space-y-3" style={{ background: 'var(--color-bg-app)', border: '1px solid var(--color-border)' }}>
                <h4 className="text-white font-semibold text-sm">תוצאות השוואה</h4>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'תואמים', val: reconcileResult.summary.matches, color: 'var(--color-success)' },
                    { label: 'סוכן גבוה', val: reconcileResult.summary.agentHigher, color: 'var(--color-warning)' },
                    { label: 'חישוב שלנו גבוה', val: reconcileResult.summary.weHigher, color: 'var(--color-warning)' },
                    { label: 'חסרה עלות', val: reconcileResult.summary.missingCost, color: 'var(--color-text-secondary)' },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: 'var(--color-bg-surface-alt)' }}>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Top discrepancies */}
                {reconcileResult.results.filter(r => r.status !== 'match' && r.status !== 'missing_our_cost' && r.diff > 0).length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>פערים בולטים:</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {reconcileResult.results
                        .filter(r => r.diff > 0.5)
                        .sort((a, b) => b.diff - a.diff)
                        .slice(0, 10)
                        .map(r => (
                          <div key={r.orderNumber} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: 'color-mix(in srgb, var(--color-warning) 15%, var(--color-bg-app))', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, var(--color-bg-app))' }}>
                            <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>#{r.orderNumber}</span>
                            <div className="flex items-center gap-4">
                              <span style={{ color: 'var(--color-text-secondary)' }}>סוכן: ₪{r.agentCost.toFixed(2)}</span>
                              <span style={{ color: 'var(--color-text-secondary)' }}>שלנו: ₪{(r.ourCost ?? 0).toFixed(2)}</span>
                              <span className="font-bold" style={{ color: 'var(--color-warning)' }}>פער: ₪{r.diff.toFixed(2)}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                background: r.status === 'agent_higher' ? 'color-mix(in srgb, var(--color-warning) 25%, var(--color-bg-app))' : 'color-mix(in srgb, var(--color-success) 25%, var(--color-bg-app))',
                                color: r.status === 'agent_higher' ? 'var(--color-warning)' : 'var(--color-success)',
                              }}>
                                {r.status === 'agent_higher' ? 'סוכן גבוה' : 'חישוב שלנו גבוה'}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={runReconcile}
              disabled={reconciling || !agentSheetId}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: reconciling ? 'var(--color-border)' : 'linear-gradient(135deg, var(--color-success), color-mix(in srgb, var(--color-success) 70%, black))' }}
            >
              <span>{reconciling ? '⏳' : '🔍'}</span>
              {reconciling ? 'מבצע השוואה...' : 'הפעל בדיקת פערים'}
            </button>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
              תוצאות יכתבו בעמודה I בגיליון שלך — ירוק=תואם, כתום=פער
            </p>
          </div>
        </div>
      </div>

      {/* Webhook info */}
      <div className="rounded-2xl border p-5" style={cardStyle}>
        <h3 className="text-white font-semibold mb-2">Shopify Webhook URL</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          אם חיברת Shopify ידנית, הוסף Webhook זה בהגדרות Shopify עבור האירוע <code className="text-[var(--color-brand-start)]">orders/create</code>
        </p>
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--color-bg-app)', border: '1px solid var(--color-border)' }}>
          <code className="text-sm text-[var(--color-success)] flex-1 text-left" dir="ltr">
            {process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.vercel.app'}/api/shopify/webhook
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/shopify/webhook`)}
            className="text-xs px-3 py-1.5 rounded-lg shrink-0"
            style={{ background: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            העתק
          </button>
        </div>
      </div>
    </div>
  )
}

function ShopifyConnectForm({ businessId, onConnected }: { businessId: string; onConnected: () => void }) {
  const [shop, setShop]         = useState('')
  const [mode, setMode]         = useState<'oauth' | 'token'>('oauth')
  const [token, setToken]       = useState('')
  const [saving, setSaving]     = useState(false)

  const inputStyle = {
    background: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
    borderRadius: '10px', padding: '10px 14px', fontSize: '13px',
    outline: 'none', width: '100%', direction: 'ltr' as const,
  }

  const shopDomain = shop.includes('.') ? shop : shop ? `${shop}.myshopify.com` : ''

  async function handleTokenSave() {
    if (!shopDomain || !token) return
    setSaving(true)
    await fetch(`/api/businesses/${businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopifyDomain: shopDomain, shopifyAccessToken: token }),
    })
    setSaving(false)
    onConnected()
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        {[
          { id: 'oauth', label: 'חיבור אוטומטי' },
          { id: 'token', label: 'Custom App Token' },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id as any)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: mode === m.id ? 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))' : 'var(--color-bg-surface)',
              color:      mode === m.id ? 'var(--color-brand-start)' : 'var(--color-text-secondary)',
              border:     `1px solid ${mode === m.id ? 'color-mix(in srgb, var(--color-brand-start) 45%, var(--color-bg-app))' : 'var(--color-border)'}`,
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'oauth' ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>כתובת החנות</label>
            <input value={shop}
              onChange={e => setShop(e.target.value.replace('https://', '').replace('http://', ''))}
              placeholder="my-store.myshopify.com" style={inputStyle} />
            {shopDomain && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>יתחבר ל: {shopDomain}</p>}
          </div>
          <a href={shopDomain ? `/api/shopify/auth?businessId=${businessId}&shop=${shopDomain}` : '#'}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white ${!shopDomain ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ background: 'linear-gradient(135deg, var(--color-brand-start), var(--color-brand-end))' }}>
            <Store className="w-4 h-4" />חבר את Shopify
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: 'color-mix(in srgb, var(--color-brand-start) 20%, var(--color-bg-app))', color: 'var(--color-brand-start)', border: '1px solid color-mix(in srgb, var(--color-brand-start) 35%, var(--color-bg-app))' }}>
            <p className="font-semibold mb-1">כיצד ליצור Custom App עם גישה לכל ההזמנות:</p>
            <ol className="list-decimal list-inside space-y-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              <li>Shopify Admin → Settings → Apps → Develop apps</li>
              <li>Create an app → שם כלשהו</li>
              <li>Configure Admin API scopes → סמן: <span style={{ color: 'var(--color-brand-start)' }}>read_orders, read_all_orders, read_products</span></li>
              <li>Save → Install app → Reveal token once → העתק</li>
            </ol>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>כתובת החנות</label>
            <input value={shop}
              onChange={e => setShop(e.target.value.replace('https://', '').replace('http://', ''))}
              placeholder="my-store.myshopify.com" style={inputStyle} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Admin API Access Token</label>
            <input value={token} onChange={e => setToken(e.target.value)}
              placeholder="shpat_..." style={inputStyle} type="password" />
          </div>
          <button onClick={handleTokenSave} disabled={!shopDomain || !token || saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--color-success), color-mix(in srgb, var(--color-success) 70%, black))' }}>
            {saving ? 'שומר...' : '✓ שמור Token'}
          </button>
        </div>
      )}
    </div>
  )
}
