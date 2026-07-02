'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface ChartData {
  date: string
  revenue: number
  profit: number
  adSpend: number
}

interface ProfitChartProps {
  data: ChartData[]
  type?: 'area' | 'bar'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg p-3 shadow-xl">
      <p className="text-[var(--color-text-secondary)] text-xs mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[var(--color-text-secondary)]">{entry.name}:</span>
          <span className="text-white font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function ProfitChart({ data, type = 'area' }: ProfitChartProps) {
  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₪${v}`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: 12 }} />
          <Bar dataKey="revenue" name="הכנסות" fill="var(--color-brand-start)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="profit" name="רווח נקי" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="adSpend" name="פרסום" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-brand-start)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-brand-start)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₪${v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: 12 }} />
        <Area type="monotone" dataKey="revenue" name="הכנסות" stroke="var(--color-brand-start)" fill="url(#colorRevenue)" strokeWidth={2} />
        <Area type="monotone" dataKey="profit" name="רווח נקי" stroke="var(--color-success)" fill="url(#colorProfit)" strokeWidth={2} />
        <Area type="monotone" dataKey="adSpend" name="פרסום" stroke="var(--color-warning)" fill="none" strokeWidth={2} strokeDasharray="4 4" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
