import { cn, formatCurrency } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number | null
  currency?: 'ILS' | 'USD' | 'none'
  subtitle?: string
  icon: LucideIcon
  trend?: number
  className?: string
  highlight?: 'profit' | 'loss' | 'neutral'
}

export function StatsCard({
  title,
  value,
  currency = 'ILS',
  subtitle,
  icon: Icon,
  trend,
  className,
  highlight,
}: StatsCardProps) {
  const displayValue =
    value == null
      ? '—'
      : currency === 'none'
      ? value.toFixed(2)
      : formatCurrency(value, currency)

  const valueColor =
    highlight === 'profit'
      ? 'text-emerald-400'
      : highlight === 'loss'
      ? 'text-red-400'
      : 'text-white'

  return (
    <div className={cn('rounded-xl border border-white/10 bg-white/5 p-6', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <p className={cn('text-2xl font-bold', valueColor)}>{displayValue}</p>
          {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
      </div>

      {trend != null && (
        <div className="mt-3 flex items-center gap-1">
          <span className={cn('text-xs font-medium', trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
          <span className="text-gray-500 text-xs">לעומת אתמול</span>
        </div>
      )}
    </div>
  )
}
