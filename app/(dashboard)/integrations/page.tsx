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
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#0D2818', border: '1px solid #22C55E30' }}>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-emerald-400 font-medium text-sm">מחובר בהצלחה</p>
                  <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>{business.shopifyDomain}</p>
                </div>
              </div>
              <button
                onClick={() => { if (confirm('לנתק את Shopify?')) disconnect({ shopifyDomain: null, shopifyAccessToken: null, shopifyWebhookSecret: null }) }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: '#2D0F0F', color: '#EF4444' }}
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

      {/* Sheet Sync — The main feature */}
      {business?.googleRefreshToken && business?.googleSheetsId && (
        <div className="rounded-2xl border p-6" style={{ background: '#0F1A2E', borderColor: '#1E3A5F' }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1E3A5F' }}>
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-lg mb-1">סנכרון אוטומטי מהגיליון</h3>
              <p className="text-sm mb-4" style={{ color: '#8B8FA8' }}>
                המערכת תסרוק את הגיליון שלך, תזהה הזמנות שטרם חושב עבורן מחיר (עמודה G ריקה),
                תמשוך את פרטיהן משופיפיי, תחשב עם AI את העלות האמיתית — ותמלא אוטומטית עמודות G ו-H.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                {[
                  { step: '1', label: 'קורא את הגיליון', desc: 'מוצא שורות עם עמודה G ריקה' },
                  { step: '2', label: 'מושך מ-Shopify', desc: 'מאתר את ההזמנה לפי מספר' },
                  { step: '3', label: 'AI מחשב ומעדכן', desc: 'ממלא עלות ורווח אוטומטית' },
                ].map(s => (
                  <div key={s.step} className="p-3 rounded-xl" style={{ background: '#1A2540' }}>
                    <div className="w-7 h-7 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-white" style={{ background: '#4F6EF7' }}>{s.step}</div>
                    <p className="text-white text-xs font-semibold">{s.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{s.desc}</p>
                  </div>
                ))}
              </div>

              {syncResult && (
                <div className="flex gap-4 mb-4 p-3 rounded-xl" style={{ background: '#1A2540' }}>
                  <div className="text-center">
                    <p className="text-emerald-400 font-bold text-xl">{syncResult.processed}</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>עודכנו</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 font-bold text-xl">{syncResult.skipped}</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>דולגו</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-400 font-bold text-xl">{syncResult.errors}</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>שגיאות</p>
                  </div>
                </div>
              )}

              <button
                onClick={syncFromSheet}
                disabled={syncingSheets}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                style={{ background: syncingSheets ? '#1E2130' : 'linear-gradient(135deg, #4F6EF7, #7C5CFC)' }}
              >
                <RefreshCw className={`w-4 h-4 ${syncingSheets ? 'animate-spin' : ''}`} />
                {syncingSheets ? 'מחשב ומעדכן את הגיליון...' : 'סנכרן והשלם עלויות בגיליון'}
              </button>
              <p className="text-xs mt-2" style={{ color: '#4A5174' }}>
                רק שורות עם עמודה G ריקה יעובדו. שורות קיימות לא יידרסו.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reconcile — Agent sheet comparison */}
      <div className="rounded-2xl border p-6" style={{ background: '#0F1A0F', borderColor: '#1A3A1A' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1A3A1A' }}>
            <span className="text-2xl">🔍</span>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-1">בדיקת פערים מול גיליון הסוכן</h3>
            <p className="text-sm mb-5" style={{ color: '#8B8FA8' }}>
              הכנס את מזהה הגיליון של הסוכן. המערכת תחשב את עלות כל הזמנה (K+L+M) ותשווה מול העלות שחישבנו (עמודה G שלך). פערים יסומנו אוטומטית בעמודה I בגיליון שלך.
            </p>

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { emoji: '📊', label: 'קורא גיליון סוכן', desc: 'K (מחיר) + L (הנחה) + M (משלוח) לפי מספר הזמנה' },
                { emoji: '⚖️', label: 'משווה עלויות', desc: 'מול עמודה G בגיליון שלך' },
                { emoji: '🚨', label: 'מסמן פערים', desc: 'כותב סטטוס בעמודה I: תואם / פער + סכום' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: '#1A2A1A' }}>
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <p className="text-white text-xs font-semibold">{s.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Inputs */}
            <div className="grid gap-3 mb-4">
              <div className="space-y-1.5">
                <label className="text-sm" style={{ color: '#8B8FA8' }}>מזהה גיליון הסוכן</label>
                <input
                  value={agentSheetId}
                  onChange={e => setAgentSheetId(e.target.value.trim())}
                  placeholder="1GpfYvjo3KGUuCuwZRE8fs_JZmYUx1AtkOoB-RkktISA"
                  style={{ background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none', width: '100%', direction: 'ltr' }}
                />
                <p className="text-xs" style={{ color: '#4A5174' }}>
                  מתוך URL הגיליון: docs.google.com/spreadsheets/d/<strong style={{ color: '#6B9F6B' }}>ID_כאן</strong>/edit
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm" style={{ color: '#8B8FA8' }}>שם הגיליון (טאב) — אופציונלי</label>
                <input
                  value={agentSheetName}
                  onChange={e => setAgentSheetName(e.target.value)}
                  placeholder="הזמנות 01/01 - 31/01"
                  style={{ background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none', width: '100%' }}
                />
                <p className="text-xs" style={{ color: '#4A5174' }}>השאר ריק לשימוש בגיליון הראשון</p>
              </div>
            </div>

            {/* Results summary */}
            {reconcileResult && (
              <div className="mb-4 rounded-xl p-4 space-y-3" style={{ background: '#0D0F14', border: '1px solid #1E2130' }}>
                <h4 className="text-white font-semibold text-sm">תוצאות השוואה</h4>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'תואמים', val: reconcileResult.summary.matches, color: '#22C55E' },
                    { label: 'סוכן גבוה', val: reconcileResult.summary.agentHigher, color: '#F59E0B' },
                    { label: 'חישוב שלנו גבוה', val: reconcileResult.summary.weHigher, color: '#F59E0B' },
                    { label: 'חסרה עלות', val: reconcileResult.summary.missingCost, color: '#6B7280' },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: '#1A1D2A' }}>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Top discrepancies */}
                {reconcileResult.results.filter(r => r.status !== 'match' && r.status !== 'missing_our_cost' && r.diff > 0).length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: '#8B8FA8' }}>פערים בולטים:</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {reconcileResult.results
                        .filter(r => r.diff > 0.5)
                        .sort((a, b) => b.diff - a.diff)
                        .slice(0, 10)
                        .map(r => (
                          <div key={r.orderNumber} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: '#1E1A0F', border: '1px solid #3A2A0F' }}>
                            <span className="font-mono" style={{ color: '#CBD5E1' }}>#{r.orderNumber}</span>
                            <div className="flex items-center gap-4">
                              <span style={{ color: '#8B8FA8' }}>סוכן: ₪{r.agentCost.toFixed(2)}</span>
                              <span style={{ color: '#8B8FA8' }}>שלנו: ₪{(r.ourCost ?? 0).toFixed(2)}</span>
                              <span className="font-bold" style={{ color: '#F59E0B' }}>פער: ₪{r.diff.toFixed(2)}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                background: r.status === 'agent_higher' ? '#2A1A00' : '#1A2A00',
                                color: r.status === 'agent_higher' ? '#F59E0B' : '#86EFAC',
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
              style={{ background: reconciling ? '#1E2130' : 'linear-gradient(135deg, #16a34a, #15803d)' }}
            >
              <span>{reconciling ? '⏳' : '🔍'}</span>
              {reconciling ? 'מבצע השוואה...' : 'הפעל בדיקת פערים'}
            </button>
            <p className="text-xs mt-2" style={{ color: '#4A5174' }}>
              תוצאות יכתבו בעמודה I בגיליון שלך — ירוק=תואם, כתום=פער
            </p>
          </div>
        </div>
      </div>

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
