'use client'

import { useEffect, useState, useCallback } from 'react'
import { ProfitChart } from '@/components/dashboard/profit-chart'
import { formatCurrency } from '@/lib/utils'

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState<'area' | 'bar'>('area')

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
      const res = await fetch(`/api/dashboard?businessId=${activeBusiness}`)
      setData(await res.json())
    } finally { setLoading(false) }
  }, [activeBusiness])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )

  const roas = (data?.stats?.monthAdSpend ?? 0) > 0
    ? ((data?.stats?.monthRevenue ?? 0) / (data?.stats?.monthAdSpend ?? 1)).toFixed(2)
    : '—'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">אנליטיקס</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'הכנסות (30 יום)', value: formatCurrency(data?.stats?.monthRevenue ?? 0) },
          { label: 'רווח נקי (30 יום)', value: formatCurrency(data?.stats?.monthProfit ?? 0), green: true },
          { label: 'הוצאות פרסום (30 יום)', value: formatCurrency(data?.stats?.monthAdSpend ?? 0) },
          { label: 'ROAS (30 יום)', value: roas === '—' ? '—' : `${roas}x` },
        ].map(({ label, value, green }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-gray-400 text-sm">{label}</p>
            <p className={`text-xl font-bold mt-1 ${green ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {data?.chartData?.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-medium">הכנסות, רווח ופרסום לאורך זמן</h2>
            <div className="flex gap-2">
              {(['area', 'bar'] as const).map(type => (
                <button key={type} onClick={() => setChartType(type)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${chartType === type ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {type === 'area' ? 'קו' : 'עמודות'}
                </button>
              ))}
            </div>
          </div>
          <ProfitChart data={data.chartData} type={chartType} />
        </div>
      )}

      {(!data?.chartData || data.chartData.length === 0) && (
        <div className="text-center py-16 text-gray-500">
          <p>אין נתונים עדיין</p>
          <p className="text-xs mt-1">חבר Shopify וסנכרן הזמנות כדי לראות גרפים</p>
        </div>
      )}
    </div>
  )
}
