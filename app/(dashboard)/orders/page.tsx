'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Download, RefreshCw, Filter } from 'lucide-react'
import { OrderRowComponent } from '@/components/orders/order-row'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [syncing, setSyncing] = useState(false)

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
    } finally {
      setLoading(false)
    }
  }, [activeBusiness, page, dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleReanalyze(orderId: string) {
    await fetch(`/api/orders/${orderId}/analyze`, { method: 'POST' })
    fetchOrders()
  }

  async function handleSync() {
    if (!activeBusiness) return
    setSyncing(true)
    try {
      const res = await fetch('/api/shopify/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: activeBusiness, daysBack: 30 }) })
      const data = await res.json()
      if (data.error) alert(`שגיאה: ${data.error}`)
      else { alert(`סנכרון הושלם: ${data.imported} הזמנות חדשות`); fetchOrders() }
    } finally { setSyncing(false) }
  }

  async function handleExport() {
    if (!activeBusiness) return
    const res = await fetch('/api/sheets/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: activeBusiness, dateFrom, dateTo }) })
    const data = await res.json()
    alert(data.error ? `שגיאה: ${data.error}` : `יוצאו ${data.exported} הזמנות לגיליון`)
  }

  const filtered = search ? orders.filter(o => o.orderNumber.includes(search) || o.orderSummary?.includes(search) || o.customerName?.includes(search)) : orders
  const totalRevenue = orders.reduce((s, o) => s + (o.storePrice ?? 0), 0)
  const totalProfit = orders.reduce((s, o) => s + (o.netProfitIls ?? 0), 0)
  const losingOrders = orders.filter(o => (o.netProfitIls ?? 0) < 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">הזמנות</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} loading={syncing}>
            <RefreshCw className="w-4 h-4" />סנכרן מ-Shopify
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4" />ייצא לגיליון
          </Button>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-gray-400 text-sm">סה"כ הכנסות</p>
            <p className="text-white text-xl font-bold">{formatCurrency(totalRevenue)}</p>
            <p className="text-gray-500 text-xs mt-1">{total} הזמנות</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-gray-400 text-sm">רווח נקי</p>
            <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(totalProfit)}</p>
            <p className="text-gray-500 text-xs mt-1">מרווח {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-gray-400 text-sm">הזמנות מפסידות</p>
            <p className="text-red-400 text-xl font-bold">{losingOrders}</p>
            <p className="text-gray-500 text-xs mt-1">מתוך {orders.length} מוצגות</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="חפש הזמנה..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" dir="ltr" />
          <span className="text-gray-500 text-sm">—</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" dir="ltr" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>אין הזמנות להצגה</p>
          <Button variant="outline" className="mt-4" onClick={handleSync} loading={syncing}>
            <RefreshCw className="w-4 h-4" />סנכרן הזמנות מ-Shopify
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => <OrderRowComponent key={order.id} order={order} onReanalyze={handleReanalyze} />)}
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>הקודם</Button>
          <span className="text-gray-400 text-sm py-2">עמוד {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}>הבא</Button>
        </div>
      )}
    </div>
  )
}
