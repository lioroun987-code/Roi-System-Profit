'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Target, Zap, RefreshCw } from 'lucide-react'
import { ProfitChart } from '@/components/dashboard/profit-chart'
import { StatsCard } from '@/components/dashboard/stats-card'
import { SectionHeader } from '@/components/dashboard/section-header'
import { OrderRowComponent } from '@/components/orders/order-row'
import { OrderRow } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'

interface DashboardData {
  stats: {
    todayRevenue: number; todayProfit: number; todayCost: number
    todayOrders: number; todayAdSpend: number; todayRoas: number
    weekRevenue: number; weekProfit: number; weekAdSpend: number
    monthRevenue: number; monthProfit: number; monthAdSpend: number
  }
  chartData: Array<{ date: string; revenue: number; profit: number; adSpend: number }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today')
  const [syncing, setSyncing]         = useState(false)
  const [lastSynced, setLastSynced]   = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('activeBusiness')
    if (stored) setActiveBusiness(stored)
    const handler = (e: CustomEvent) => setActiveBusiness(e.detail)
    window.addEventListener('businessChange', handler as EventListener)
    return () => window.removeEventListener('businessChange', handler as EventListener)
  }, [])

  // Sync recent Shopify orders into DB
  const syncRecent = useCallback(async (bid: string, daysBack = 7) => {
    setSyncing(true)
    try {
      await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: bid, daysBack }),
      })
      setLastSynced(new Date())
    } catch { /* non-fatal */ }
    finally { setSyncing(false) }
  }, [])

  const fetchData = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const [dashRes, ordersRes] = await Promise.all([
        fetch(`/api/dashboard?businessId=${activeBusiness}`),
        fetch(`/api/orders?businessId=${activeBusiness}&limit=8`),
      ])
      const [dash, ordersData] = await Promise.all([dashRes.json(), ordersRes.json()])
      setData(dash)
      setOrders(ordersData.orders ?? [])
    } finally { setLoading(false) }
  }, [activeBusiness])

  useEffect(() => {
    if (!activeBusiness) return

    // Initial load: sync last 7 days then fetch dashboard
    syncRecent(activeBusiness, 7).then(() => fetchData())

    // Auto-poll every 60s: first refresh stats (fast DB query), then sync last 3h
    pollRef.current = setInterval(async () => {
      // 1. Refresh displayed stats immediately from DB
      try {
        const r = await fetch(`/api/dashboard?businessId=${activeBusiness}`)
        if (r.ok) setData(await r.json())
      } catch { /* ignore */ }
      // 2. Pull any new orders from Shopify in background
      syncRecent(activeBusiness, 0.125)  // last 3 hours
    }, 60_000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeBusiness, syncRecent, fetchData])

  async function handleReanalyze(orderId: string) {
    await fetch(`/api/orders/${orderId}/analyze`, { method: 'POST' })
    fetchData()
  }

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2 bg-[var(--color-border)]">
          <Zap className="w-8 h-8 text-[var(--color-brand-start)]" />
        </div>
        <h2 className="text-white text-xl font-bold">ברוך הבא לרווחיות</h2>
        <p className="text-gray-400 text-center max-w-sm">צור עסק ראשון כדי להתחיל לעקוב אחר הרווחיות שלך</p>
        <a href="/onboarding" className="px-6 py-3 rounded-xl font-medium text-white text-sm brand-gradient">
          התחל הגדרה
        </a>
      </div>
    )
  }

  const s = data?.stats
  const rangeRevenue = dateRange === 'today' ? s?.todayRevenue : dateRange === 'week' ? s?.weekRevenue : s?.monthRevenue
  const rangeProfit = dateRange === 'today' ? s?.todayProfit : dateRange === 'week' ? s?.weekProfit : s?.monthProfit
  const rangeAdSpend = dateRange === 'today' ? s?.todayAdSpend : dateRange === 'week' ? s?.weekAdSpend : s?.monthAdSpend
  const rangeRoas = rangeAdSpend && rangeAdSpend > 0 && rangeRevenue ? rangeRevenue / rangeAdSpend : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">סקירה כללית</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                syncing ? 'bg-[var(--color-warning)] animate-pulse' : 'bg-[var(--color-success)]'
              )}
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {syncing
                ? 'מסנכרן...'
                : lastSynced
                  ? `עודכן ${lastSynced.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} · מתרענן אוטומטית`
                  : 'מתרענן אוטומטית כל דקה'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range */}
          <div className="flex rounded-xl p-0.5 border bg-[var(--color-bg-surface)] border-[var(--color-border)]">
            {(['today', 'week', 'month'] as const).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  dateRange === r
                    ? 'bg-[var(--color-bg-surface-alt)] text-[var(--color-brand-start)]'
                    : 'bg-transparent text-[var(--color-text-secondary)]'
                )}
              >
                {r === 'today' ? 'היום' : r === 'week' ? '7 ימים' : '30 ימים'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="w-9 h-9 rounded-xl border flex items-center justify-center transition-colors bg-[var(--color-bg-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl p-5 h-32 animate-pulse border bg-[var(--color-bg-surface)] border-[var(--color-border)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard label="הכנסות" value={rangeRevenue ?? null} icon={DollarSign} color="var(--color-brand-start)" sub="סה״כ תשלומים" />
          <StatsCard label="רווח נקי" value={rangeProfit ?? null} icon={(rangeProfit ?? 0) >= 0 ? TrendingUp : TrendingDown} color={(rangeProfit ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} sub="אחרי כל העלויות" />
          <StatsCard label="הוצאות פרסום" value={rangeAdSpend ?? null} icon={Target} color="var(--color-warning)" sub="Facebook Ads" />
          <StatsCard label="ROAS אמיתי" value={rangeRoas} icon={Zap} color="var(--color-accent-violet)" format="x" sub="על בסיס רווח" />
        </div>
      )}

      {/* Chart + Summary */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl p-5 border bg-[var(--color-bg-surface)] border-[var(--color-border)]">
          <SectionHeader title="הכנסות ורווח לאורך זמן" />
          {data?.chartData && data.chartData.length > 0 ? (
            <ProfitChart data={data.chartData} />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-tertiary)]">
              אין נתונים עדיין — חבר Shopify וסנכרן הזמנות
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5 border bg-[var(--color-bg-surface)] border-[var(--color-border)]">
          <SectionHeader title="סיכום תקופה" />
          <div className="space-y-3">
            {[
              { label: 'הכנסות', val: rangeRevenue, color: 'var(--color-brand-start)' },
              { label: 'עלויות מוצרים', val: s?.todayCost ?? null, color: 'var(--color-danger)' },
              { label: 'רווח גולמי', val: (rangeRevenue ?? 0) - (s?.todayCost ?? 0), color: 'var(--color-success)' },
              { label: 'הוצאות פרסום', val: rangeAdSpend, color: 'var(--color-warning)' },
              { label: 'רווח נקי', val: rangeProfit, color: 'var(--color-accent-violet)' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-[var(--color-bg-surface-alt)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-white">{formatCurrency(item.val ?? 0)}</span>
              </div>
            ))}
          </div>

          {rangeRevenue && rangeRevenue > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-[var(--color-bg-app)]">
              <p className="text-xs mb-1 text-[var(--color-text-tertiary)]">מרווח</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-[var(--color-border)]">
                  <div
                    className={cn('h-full rounded-full', (rangeProfit ?? 0) >= 0 ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]')}
                    style={{ width: `${Math.min(100, Math.max(0, ((rangeProfit ?? 0) / rangeRevenue) * 100))}%` }}
                  />
                </div>
                <span className={cn('text-sm font-bold', (rangeProfit ?? 0) >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>
                  {rangeRevenue > 0 ? (((rangeProfit ?? 0) / rangeRevenue) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <SectionHeader
          title="הזמנות אחרונות"
          action="כל ההזמנות ←"
          onAction={() => window.location.href = '/orders'}
        />
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse bg-[var(--color-bg-surface)]" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl p-10 text-center border bg-[var(--color-bg-surface)] border-[var(--color-border)]">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20 text-white" />
            <p className="text-sm text-[var(--color-text-tertiary)]">אין הזמנות עדיין — חבר Shopify ולחץ סנכרן</p>
            <a href="/integrations" className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white brand-gradient">
              חבר Shopify
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(order => <OrderRowComponent key={order.id} order={order} onReanalyze={handleReanalyze} />)}
          </div>
        )}
      </div>
    </div>
  )
}
