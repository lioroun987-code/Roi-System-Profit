import { cn, formatCurrency } from '@/lib/utils'
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: number | null
  icon: LucideIcon
  trend?: number
  sub?: string
  /** Accent color for the icon badge — any valid CSS color (hex or var()). Defaults to brand. */
  color?: string
  format?: 'ils' | 'usd' | 'number' | 'x'
  className?: string
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  sub,
  color = 'var(--color-brand-start)',
  format = 'ils',
  className,
}: StatsCardProps) {
  const displayValue =
    value == null
      ? '—'
      : format === 'ils'
      ? formatCurrency(value)
      : format === 'usd'
      ? formatCurrency(value, 'USD')
      : format === 'x'
      ? `${value.toFixed(1)}x`
      : value.toLocaleString()

  const isPositive = (trend ?? 0) >= 0

  return (
    <div
      className={cn(
        'rounded-2xl p-5 border bg-[var(--color-bg-surface)] border-[var(--color-border)]',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{displayValue}</p>
      {(sub || trend != null) && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend != null && (
            <div
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
              )}
            >
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
          {sub && <span className="text-xs text-[var(--color-text-tertiary)]">{sub}</span>}
        </div>
      )}
    </div>
  )
}
