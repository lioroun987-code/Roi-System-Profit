'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Target, Zap, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { ProfitChart } from '@/components/dashboard/profit-chart'
import { OrderRowComponent } from '@/components/orders/order-row'
import { OrderRow } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface DashboardData {
  stats: {
    todayRevenue: number; todayProfit: number; todayCost: number
    todayOrders: number; todayAdSpend: number; todayRoas: number
    weekRevenue: number; weekProfit: number; weekAdSpend: number
    monthRevenue: number; monthProfit: number; monthAdSpend: number
  }
  chartData: Array<{ date: string; revenue: number; profit: number; adSpend: number }>
}

function MetricCard({ label, value, sub, icon: Icon, trend, color = '#4F6EF7', format = 'ils' }: {
  label: string; value: number | null; sub?: string; icon: any
  trend?: number; color?: string; format?: 'ils' | 'usd' | 'number' | 'x'
}) {
  const displayValue = value == null ? '—'
    : format === 'ils' ? formatCurrency(value)
    : format === 'usd' ? formatCurrency(value, 'USD')
    : format === 'x' ? `${value.toFixed(1)}x`
    : value.toLocaleString()

  const isPositive = (trend ?? 0) >= 0

  return (
    <div className="rounded-2xl p-5 border" style={{ background: '#13161F', borderColor: '#1E2130' }}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium" style={{ color: '#6B7280' }}>{label}</p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{displayValue}</p>
      {(sub || trend != null) && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend != null && (
            <div className="flex items-center gap-0.5 text-xs font-medium" style={{ color: isPositive ? '#22C55E' : '#EF4444' }}>
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
          {sub && <span className="text-xs" style={{ color: '#4A5174' }}>{sub}</span>}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: '#4F6EF7' }}>
          {action}
        </button>
      )}
    </div>
  )
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
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2" style={{ background: '#1E2130' }}>
          <Zap className="w-8 h-8" style={{ color: '#4F6EF7' }} />
        </div>
        <h2 className="text-white text-xl font-bold">ברוך הבא לרווחיות</h2>
        <p className="text-gray-400 text-center max-w-sm">צור עסק ראשון כדי להתחיל לעקוב אחר הרווחיות שלך</p>
        <a href="/onboarding" className="px-6 py-3 rounded-xl font-medium text-white text-sm" style={{ background: '#4F6EF7' }}>
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
            <div className="w-1.5 h-1.5 rounded-full" style={{
              background: syncing ? '#F59E0B' : '#22C55E',
              animation: syncing ? 'pulse 1s infinite' : 'none',
            }} />
            <p className="text-xs" style={{ color: '#4A5174' }}>
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
          <div className="flex rounded-xl p-0.5 border" style={{ background: '#13161F', borderColor: '#1E2130' }}>
            {(['today', 'week', 'month'] as const).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: dateRange === r ? '#1E2846' : 'transparent',
                  color: dateRange === r ? '#4F6EF7' : '#6B7280',
                }}
              >
                {r === 'today' ? 'היום' : r === 'week' ? '7 ימים' : '30 ימים'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="w-9 h-9 rounded-xl border flex items-center justify-center transition-colors"
            style={{ background: '#13161F', borderColor: '#1E2130', color: '#6B7280' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl p-5 h-32 animate-pulse border" style={{ background: '#13161F', borderColor: '#1E2130' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="הכנסות" value={rangeRevenue ?? null} icon={DollarSign} color="#4F6EF7" sub="סה״כ תשלומים" />
          <MetricCard label="רווח נקי" value={rangeProfit ?? null} icon={(rangeProfit ?? 0) >= 0 ? TrendingUp : TrendingDown} color={(rangeProfit ?? 0) >= 0 ? '#22C55E' : '#EF4444'} sub="אחרי כל העלויות" />
          <MetricCard label="הוצאות פרסום" value={rangeAdSpend ?? null} icon={Target} color="#F59E0B" sub="Facebook Ads" />
          <MetricCard label="ROAS אמיתי" value={rangeRoas} icon={Zap} color="#A855F7" format="x" sub="על בסיס רווח" />
        </div>
      )}

      {/* Chart + Summary */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl p-5 border" style={{ background: '#13161F', borderColor: '#1E2130' }}>
          <SectionHeader title="הכנסות ורווח לאורך זמן" />
          {data?.chartData && data.chartData.length > 0 ? (
            <ProfitChart data={data.chartData} />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm" style={{ color: '#4A5174' }}>
              אין נתונים עדיין — חבר Shopify וסנכרן הזמנות
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5 border" style={{ background: '#13161F', borderColor: '#1E2130' }}>
          <SectionHeader title="סיכום תקופה" />
          <div className="space-y-3">
            {[
              { label: 'הכנסות', val: rangeRevenue, color: '#4F6EF7' },
              { label: 'עלויות מוצרים', val: s?.todayCost ?? null, color: '#EF4444' },
              { label: 'רווח גולמי', val: (rangeRevenue ?? 0) - (s?.todayCost ?? 0), color: '#22C55E' },
              { label: 'הוצאות פרסום', val: rangeAdSpend, color: '#F59E0B' },
              { label: 'רווח נקי', val: rangeProfit, color: '#A855F7' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#1A1D2A' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm" style={{ color: '#8B8FA8' }}>{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-white">{formatCurrency(item.val ?? 0)}</span>
              </div>
            ))}
          </div>

          {rangeRevenue && rangeRevenue > 0 && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: '#0D0F14' }}>
              <p className="text-xs mb-1" style={{ color: '#4A5174' }}>מרווח</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#1E2130' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, ((rangeProfit ?? 0) / rangeRevenue) * 100))}%`, background: (rangeProfit ?? 0) >= 0 ? '#22C55E' : '#EF4444' }} />
                </div>
                <span className="text-sm font-bold" style={{ color: (rangeProfit ?? 0) >= 0 ? '#22C55E' : '#EF4444' }}>
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
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#13161F' }} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl p-10 text-center border" style={{ background: '#13161F', borderColor: '#1E2130' }}>
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20 text-white" />
            <p className="text-sm" style={{ color: '#4A5174' }}>אין הזמנות עדיין — חבר Shopify ולחץ סנכרן</p>
            <a href="/integrations" className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#4F6EF7' }}>
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
