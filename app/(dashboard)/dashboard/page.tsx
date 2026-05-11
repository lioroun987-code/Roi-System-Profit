'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, ShoppingCart, DollarSign, Target, BarChart2, RefreshCw } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/stats-card'
import { ProfitChart } from '@/components/dashboard/profit-chart'
import { OrderRowComponent } from '@/components/orders/order-row'
import { Button } from '@/components/ui/button'
import { OrderRow } from '@/types'

interface DashboardData {
  stats: {
    todayRevenue: number
    todayProfit: number
    todayCost: number
    todayOrders: number
    todayAdSpend: number
    todayRoas: number
    weekRevenue: number
    weekProfit: number
    weekAdSpend: number
    monthRevenue: number
    monthProfit: number
    monthAdSpend: number
  }
  chartData: Array<{ date: string; revenue: number; profit: number; adSpend: number }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([])
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('activeBusiness')
    if (stored) setActiveBusiness(stored)
    const handler = (e: CustomEvent) => setActiveBusiness(e.detail)
    window.addEventListener('businessChange', handler as EventListener)
    return () => window.removeEventListener('businessChange', handler as EventListener)
  }, [])

  const fetchData = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const [dashRes, ordersRes] = await Promise.all([
        fetch(`/api/dashboard?businessId=${activeBusiness}`),
        fetch(`/api/orders?businessId=${activeBusiness}&limit=10`),
      ])
      const [dash, orders] = await Promise.all([dashRes.json(), ordersRes.json()])
      setData(dash)
      setRecentOrders(orders.orders ?? [])
    } finally {
      setLoading(false)
    }
  }, [activeBusiness])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleReanalyze(orderId: string) {
    await fetch(`/api/orders/${orderId}/analyze`, { method: 'POST' })
    fetchData()
  }

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-400">אין עסק מחובר. צור עסק חדש כדי להתחיל.</p>
        <Button onClick={() => window.location.href = '/settings/business/new'}>
          צור עסק ראשון
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const stats = data?.stats

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">לוח בקרה</h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4" />
          רענן
        </Button>
      </div>

      <div>
        <h2 className="text-gray-400 text-sm font-medium mb-3">היום</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatsCard title="הכנסות" value={stats?.todayRevenue ?? null} icon={DollarSign} />
          <StatsCard title="רווח נקי" value={stats?.todayProfit ?? null} icon={TrendingUp} highlight={(stats?.todayProfit ?? 0) >= 0 ? 'profit' : 'loss'} />
          <StatsCard title="הזמנות" value={stats?.todayOrders ?? null} currency="none" icon={ShoppingCart} />
          <StatsCard title="פרסום" value={stats?.todayAdSpend ?? null} icon={BarChart2} />
          <StatsCard title="ROAS" value={stats?.todayRoas ?? null} currency="none" icon={Target} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-white font-medium">שבוע אחרון</h3>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[{ label: 'הכנסות', val: stats?.weekRevenue }, { label: 'רווח', val: stats?.weekProfit }, { label: 'פרסום', val: stats?.weekAdSpend }].map(({ label, val }) => (
              <div key={label}>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className={`text-sm font-semibold ${label === 'רווח' ? ((val ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>
                  ₪{(val ?? 0).toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-white font-medium">30 יום אחרונים</h3>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[{ label: 'הכנסות', val: stats?.monthRevenue }, { label: 'רווח', val: stats?.monthProfit }, { label: 'פרסום', val: stats?.monthAdSpend }].map(({ label, val }) => (
              <div key={label}>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className={`text-sm font-semibold ${label === 'רווח' ? ((val ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>
                  ₪{(val ?? 0).toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data?.chartData && data.chartData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-white font-medium mb-4">גרף הכנסות ורווח</h2>
          <ProfitChart data={data.chartData} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-medium">הזמנות אחרונות</h2>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/orders'}>
            כל ההזמנות →
          </Button>
        </div>
        <div className="space-y-2">
          {recentOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>אין הזמנות עדיין</p>
              <p className="text-xs mt-1">חבר את Shopify מדף האינטגרציות</p>
            </div>
          ) : (
            recentOrders.map(order => (
              <OrderRowComponent key={order.id} order={order} onReanalyze={handleReanalyze} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
