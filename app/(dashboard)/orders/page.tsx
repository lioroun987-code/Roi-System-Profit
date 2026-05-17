'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Download, RefreshCw, Filter, TrendingUp, TrendingDown, ShoppingCart, History, X, Zap } from 'lucide-react'
import { OrderRowComponent } from '@/components/orders/order-row'
import { OrderRow } from '@/types'
import { formatCurrency } from '@/lib/utils'

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [syncing, setSyncing]     = useState(false)
  const [exporting, setExporting] = useState(false)
  const [syncAllOpen, setSyncAllOpen]       = useState(false)
  const [syncAllStatus, setSyncAllStatus]   = useState<'idle'|'running'|'done'>('idle')
  const [syncAllProgress, setSyncAllProgress] = useState({ processed: 0, skipped: 0, usedAI: 0, errors: 0 })
  const [reanalyzeAllOpen, setReanalyzeAllOpen]   = useState(false)
  const [reanalyzeAllStatus, setReanalyzeAllStatus] = useState<'idle'|'running'|'done'>('idle')
  const [reanalyzeAllStats, setReanalyzeAllStats] = useState({
    processed: 0, changed: 0, failed: 0, skipped: 0, total: 0, percentDone: 0,
  })

  useEffect(() => {
    const stored = localStorage.getItem('activeBusiness')
    if (stored) setActiveBusiness(stored)
    const handler = (e: CustomEvent) => setActiveBusiness(e.detail)
    window.addEventListener('businessChange', handler as EventListener)
    return () => window.removeEventListener('businessChange', handler as EventListener)
  }, [])

  const fetchOrders = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: activeBusiness, page: String(page), limit: '50', ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) })
      const res = await fetch(`/api/orders?${params}`)
      const data = await res.json()
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
    } finally { setLoading(false) }
  }, [activeBusiness, page, dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleReanalyze(orderId: string) {
    await fetch(`/api/orders/${orderId}/analyze`, { method: 'POST' })
    fetchOrders()
  }

  async function handleReanalyzeAll() {
    if (!activeBusiness) return
    setReanalyzeAllOpen(true)
    setReanalyzeAllStatus('running')
    setReanalyzeAllStats({ processed: 0, changed: 0, failed: 0, skipped: 0, total: 0, percentDone: 0 })

    let cursor = 0
    let totals = { processed: 0, changed: 0, failed: 0, skipped: 0, total: 0, percentDone: 0 }

    while (true) {
      const batchRes: Response = await fetch('/api/orders/reanalyze-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: activeBusiness, cursor }),
      })
      if (!batchRes.ok) break
      const data: any = await batchRes.json()

      totals = {
        processed:  totals.processed  + (data.processed ?? 0),
        changed:    totals.changed    + (data.changed   ?? 0),
        failed:     totals.failed     + (data.failed    ?? 0),
        skipped:    totals.skipped    + (data.skipped   ?? 0),
        total:      data.total ?? totals.total,
        percentDone: data.percentDone ?? 0,
      }
      setReanalyzeAllStats({ ...totals })

      if (data.done || !data.nextCursor) break
      cursor = data.nextCursor
    }

    setReanalyzeAllStatus('done')
    fetchOrders()
  }

  async function handleSync() {
    if (!activeBusiness) return
    setSyncing(true)
    try {
      const res = await fetch('/api/shopify/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: activeBusiness, daysBack: 30 }) })
      const data = await res.json()
      if (data.error) alert(`שגיאה: ${data.error}`)
      else { alert(`${data.imported} הזמנות חדשות, ${data.skipped} כבר קיימות`); fetchOrders() }
    } finally { setSyncing(false) }
  }

  async function handleSyncAll() {
    if (!activeBusiness) return
    setSyncAllOpen(true)
    setSyncAllStatus('running')
    setSyncAllProgress({ processed: 0, skipped: 0, usedAI: 0, errors: 0 })

    let sinceId = '0'
    let totalProcessed = 0, totalSkipped = 0, totalAI = 0, totalErrors = 0
    let retries = 0
    const MAX_RETRIES = 5

    while (true) {
      let batchRes: Response
      try {
        batchRes = await fetch('/api/shopify/sync-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: activeBusiness, sinceId }),
        })
      } catch {
        if (retries++ < MAX_RETRIES) { await new Promise(r => setTimeout(r, 2000)); continue }
        break
      }

      if (!batchRes.ok) {
        if (retries++ < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, batchRes.status === 429 ? 5000 : 2000))
          continue
        }
        break
      }

      retries = 0
      const data: any = await batchRes.json()
      totalProcessed += data.processed ?? 0
      totalSkipped   += data.skipped   ?? 0
      totalAI        += data.usedAI    ?? 0
      totalErrors    += data.errors    ?? 0
      setSyncAllProgress({ processed: totalProcessed, skipped: totalSkipped, usedAI: totalAI, errors: totalErrors })
      if (data.done) break
      sinceId = data.nextSinceId ?? '0'

      await new Promise(r => setTimeout(r, 200))
    }

    setSyncAllStatus('done')
    fetchOrders()
  }

  async function handleExport() {
    if (!activeBusiness) return
    setExporting(true)
    try {
      const res = await fetch('/api/sheets/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: activeBusiness, dateFrom, dateTo }) })
      const data = await res.json()
      alert(data.error ? `שגיאה: ${data.error}` : `יוצאו ${data.exported} הזמנות`)
    } finally { setExporting(false) }
  }

  const filtered = search ? orders.filter(o => o.orderNumber.includes(search) || o.orderSummary?.includes(search) || o.customerName?.includes(search)) : orders
  const totalRevenue = orders.reduce((s, o) => s + (o.storePrice ?? 0), 0)
  const totalProfit = orders.reduce((s, o) => s + (o.netProfitIls ?? 0), 0)
  const losingOrders = orders.filter(o => (o.netProfitIls ?? 0) < 0).length
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const inputStyle = {
    background: '#13161F',
    border: '1px solid #1E2130',
    color: '#CBD5E1',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
  }

  return (
    <div className="p-6 space-y-5">

      {/* Sync All Modal */}
      {syncAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-8 w-full max-w-md text-center" style={{ background: '#0D0F14', border: '1px solid #1E2130' }}>
            {syncAllStatus === 'running' ? (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"
                  style={{ background: '#1E2846' }}>
                  <History className="w-7 h-7" style={{ color: '#4F6EF7' }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-1">מעבד היסטוריית הזמנות</h3>
                <p className="text-sm mb-6" style={{ color: '#6B7280' }}>זה עשוי לקחת מספר דקות...</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'עובדו',       val: syncAllProgress.processed, color: '#22C55E' },
                    { label: 'קיימות',      val: syncAllProgress.skipped,   color: '#6B7280' },
                    { label: 'עם AI',       val: syncAllProgress.usedAI,    color: '#4F6EF7' },
                    { label: 'שגיאות',     val: syncAllProgress.errors,    color: '#EF4444' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3" style={{ background: '#13161F', border: '1px solid #1E2130' }}>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#0D2818' }}>
                  <History className="w-7 h-7" style={{ color: '#22C55E' }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-1">הסנכרון הושלם!</h3>
                <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
                  עובדו {syncAllProgress.processed} הזמנות · {syncAllProgress.usedAI} עם AI · {syncAllProgress.skipped} כבר קיימות
                </p>
                <button onClick={() => { setSyncAllOpen(false); setSyncAllStatus('idle') }}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)' }}>
                  סגור
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reanalyze All Modal */}
      {reanalyzeAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-8 w-full max-w-md text-center" style={{ background: '#0D0F14', border: '1px solid #1E2130' }}>
            {reanalyzeAllStatus === 'running' ? (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"
                  style={{ background: '#1E1846' }}>
                  <Zap className="w-7 h-7" style={{ color: '#8B5CF6' }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-1">מחשב מחדש את כל ההזמנות</h3>
                <p className="text-sm mb-4" style={{ color: '#6B7280' }}>זה עשוי לקחת מספר שניות...</p>
                {/* Progress bar */}
                <div className="w-full rounded-full h-2 mb-6" style={{ background: '#1E2130' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${reanalyzeAllStats.percentDone}%`, background: 'linear-gradient(90deg,#6366F1,#8B5CF6)' }} />
                </div>
                <p className="text-xs mb-4" style={{ color: '#4A5174' }}>
                  {reanalyzeAllStats.percentDone}% · {reanalyzeAllStats.processed} מתוך {reanalyzeAllStats.total} הזמנות
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'עודכנו',   val: reanalyzeAllStats.changed,   color: '#8B5CF6' },
                    { label: 'עובדו',    val: reanalyzeAllStats.processed,  color: '#22C55E' },
                    { label: 'שגיאות',  val: reanalyzeAllStats.failed,     color: '#EF4444' },
                    { label: 'דולגו',   val: reanalyzeAllStats.skipped,    color: '#6B7280' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3" style={{ background: '#13161F', border: '1px solid #1E2130' }}>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#1E1846' }}>
                  <Zap className="w-7 h-7" style={{ color: '#8B5CF6' }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-1">העדכון הושלם!</h3>

                {/* Summary line */}
                <div className="rounded-xl px-4 py-3 mb-4 text-right" style={{ background: '#13161F', border: '1px solid #1E2130' }}>
                  <p className="text-sm font-semibold text-white">
                    {reanalyzeAllStats.processed + reanalyzeAllStats.skipped} הזמנות ב-DB
                    {reanalyzeAllStats.skipped > 0 && (
                      <span className="text-xs font-normal mr-1" style={{ color: '#6B7280' }}>
                        ({reanalyzeAllStats.skipped} ללא raw data)
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: reanalyzeAllStats.failed > 0 ? '#EF4444' : '#22C55E' }}>
                    {reanalyzeAllStats.failed === 0
                      ? '✓ לא פוספסה אף הזמנה'
                      : `⚠ ${reanalyzeAllStats.failed} הזמנות נכשלו`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  {[
                    { label: 'ערך השתנה',          val: reanalyzeAllStats.changed,                                    color: '#8B5CF6' },
                    { label: 'ערך זהה',             val: reanalyzeAllStats.processed - reanalyzeAllStats.changed,     color: '#22C55E' },
                    { label: 'שגיאות',              val: reanalyzeAllStats.failed,                                     color: '#EF4444' },
                    { label: 'ללא raw data',        val: reanalyzeAllStats.skipped,                                    color: '#6B7280' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3" style={{ background: '#0D0F14', border: '1px solid #1E2130' }}>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {reanalyzeAllStats.processed + reanalyzeAllStats.skipped < 6000 && (
                  <p className="text-xs mb-4 px-3 py-2 rounded-lg text-right" style={{ background: '#1A1200', color: '#F59E0B', border: '1px solid #78350F' }}>
                    ⚠ נראה שחסרות הזמנות — לחץ "עבד היסטוריה" כדי לייבא את כולן מ-Shopify
                  </p>
                )}

                <button onClick={() => { setReanalyzeAllOpen(false); setReanalyzeAllStatus('idle') }}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                  סגור
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">הזמנות</h1>
          <p className="text-sm mt-0.5" style={{ color: '#4A5174' }}>{total} הזמנות סה"כ</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReanalyzeAll}
            disabled={reanalyzeAllStatus === 'running'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
            style={{ background: reanalyzeAllStatus === 'running' ? '#1E2130' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff' }}
            title="מחשב מחדש את כל ההזמנות לפי הקונפיג הנוכחי"
          >
            <Zap className={`w-4 h-4 ${reanalyzeAllStatus === 'running' ? 'animate-pulse' : ''}`} />
            {reanalyzeAllStatus === 'running'
              ? `מחשב... ${reanalyzeAllStats.percentDone}%`
              : 'עדכן כל ההזמנות'}
          </button>
          <button
            onClick={handleSyncAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border"
            style={{ background: '#13161F', borderColor: '#1E2130', color: '#CBD5E1' }}
          >
            <History className="w-4 h-4" />
            עבד היסטוריה
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border"
            style={{ background: '#13161F', borderColor: '#1E2130', color: '#CBD5E1' }}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'מסנכרן...' : 'סנכרן Shopify'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border"
            style={{ background: '#13161F', borderColor: '#1E2130', color: '#CBD5E1' }}
          >
            <Download className="w-4 h-4" />
            {exporting ? 'מייצא...' : 'ייצא לגיליון'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'הכנסות', val: formatCurrency(totalRevenue), icon: ShoppingCart, color: '#4F6EF7' },
            { label: 'רווח נקי', val: formatCurrency(totalProfit), icon: totalProfit >= 0 ? TrendingUp : TrendingDown, color: totalProfit >= 0 ? '#22C55E' : '#EF4444' },
            { label: 'מרווח ממוצע', val: `${avgMargin.toFixed(1)}%`, icon: TrendingUp, color: '#A855F7' },
            { label: 'הזמנות מפסידות', val: String(losingOrders), icon: TrendingDown, color: '#EF4444' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-4 border" style={{ background: '#13161F', borderColor: '#1E2130' }}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <p className="text-xs" style={{ color: '#6B7280' }}>{stat.label}</p>
              </div>
              <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4A5174' }} />
          <input
            placeholder="חפש לפי מספר, שם לקוח או מוצר..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingRight: '36px', width: '100%' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 shrink-0" style={{ color: '#4A5174' }} />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: '140px' }} dir="ltr" />
          <span style={{ color: '#4A5174' }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, width: '140px' }} dir="ltr" />
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#13161F' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-14 text-center border" style={{ background: '#13161F', borderColor: '#1E2130' }}>
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-10 text-white" />
          <p className="text-white font-medium mb-1">אין הזמנות</p>
          <p className="text-sm mb-4" style={{ color: '#4A5174' }}>סנכרן הזמנות מ-Shopify כדי להתחיל</p>
          <button onClick={handleSync} disabled={syncing} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: '#4F6EF7' }}>
            {syncing ? 'מסנכרן...' : 'סנכרן עכשיו'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => <OrderRowComponent key={order.id} order={order} onReanalyze={handleReanalyze} />)}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center items-center gap-3 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
            style={{ background: '#13161F', borderColor: '#1E2130', color: page === 1 ? '#4A5174' : '#CBD5E1' }}
          >
            הקודם
          </button>
          <span className="text-sm" style={{ color: '#6B7280' }}>עמוד {page} מתוך {Math.ceil(total / 50)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 50 >= total}
            className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
            style={{ background: '#13161F', borderColor: '#1E2130', color: page * 50 >= total ? '#4A5174' : '#CBD5E1' }}
          >
            הבא
          </button>
        </div>
      )}
    </div>
  )
}
