import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined, currency: 'ILS' | 'USD' = 'ILS'): string {
  if (amount == null) return '—'
  const formatter = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter.format(amount)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function getProfitColor(profit: number | null | undefined): string {
  if (profit == null) return 'text-gray-400'
  if (profit > 0) return 'text-emerald-400'
  if (profit < 0) return 'text-red-400'
  return 'text-gray-400'
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function subDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return d
}
