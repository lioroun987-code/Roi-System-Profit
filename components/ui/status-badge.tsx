import { Badge } from '@/components/ui/badge'

export type OrderStatus = 'analyzed' | 'error' | 'pending' | string

const statusConfig: Record<string, { variant: 'success' | 'destructive' | 'secondary'; label: string }> = {
  analyzed: { variant: 'success', label: 'נותח' },
  error: { variant: 'destructive', label: 'שגיאה' },
  pending: { variant: 'secondary', label: 'ממתין' },
}

export function StatusBadge({ status, label }: { status: OrderStatus; label?: string }) {
  const config = statusConfig[status] ?? { variant: 'secondary' as const, label: status }
  return <Badge variant={config.variant}>{label ?? config.label}</Badge>
}
