'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { OrderRow as OrderRowType, AIOrderAnalysis } from '@/types'
import { cn, formatCurrency, formatDate, getProfitColor } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface OrderRowProps {
  order: OrderRowType
  onReanalyze?: (orderId: string) => Promise<void>
}

export function OrderRowComponent({ order, onReanalyze }: OrderRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)

  const analysis = order.aiAnalysis as AIOrderAnalysis | null
  const profitColor = getProfitColor(order.netProfitIls)
  const isLoss = (order.netProfitIls ?? 0) < 0

  async function handleReanalyze() {
    if (!onReanalyze) return
    setReanalyzing(true)
    try { await onReanalyze(order.id) } finally { setReanalyzing(false) }
  }

  return (
    <div className={cn(
      'border border-white/10 rounded-lg overflow-hidden transition-all',
      isLoss && 'border-red-500/30 bg-red-500/5'
    )}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-gray-400 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-medium text-sm">#{order.orderNumber}</span>
            <span className="text-gray-500 text-xs">{formatDate(order.orderDate)}</span>
            {order.customerName && (
              <span className="text-gray-500 text-xs">• {order.customerName}</span>
            )}
          </div>
          <p className="text-gray-400 text-sm truncate">
            {order.orderSummary ?? 'טוען ניתוח...'}
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {order.storePrice != null && (
            <div className="text-right">
              <p className="text-gray-500 text-xs">מחיר חנות</p>
              <p className="text-white text-sm font-medium">{formatCurrency(order.storePrice)}</p>
            </div>
          )}
          {order.netProfitIls != null && (
            <div className="text-right">
              <p className="text-gray-500 text-xs">רווח נקי</p>
              <p className={cn('text-sm font-bold', profitColor)}>
                {formatCurrency(order.netProfitIls)}
              </p>
            </div>
          )}
          <Badge
            variant={
              order.status === 'analyzed' ? 'success' :
              order.status === 'error' ? 'destructive' : 'secondary'
            }
          >
            {order.status === 'analyzed' ? 'נותח' : order.status === 'error' ? 'שגיאה' : 'ממתין'}
          </Badge>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 px-4 py-4 bg-black/20">
          {analysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-white text-sm font-medium mb-3">פירוט מחיר לקוח</h4>
                <div className="space-y-1">
                  {analysis.store_price_breakdown.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-400">{item.name}</span>
                      <span className="text-white">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  {analysis.store_price_breakdown.shipping_customer > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">משלוח</span>
                      <span className="text-white">{formatCurrency(analysis.store_price_breakdown.shipping_customer)}</span>
                    </div>
                  )}
                  {analysis.store_price_breakdown.pickup_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">עמלת נקודת איסוף</span>
                      <span className="text-white">{formatCurrency(analysis.store_price_breakdown.pickup_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold border-t border-white/10 pt-1 mt-1">
                    <span className="text-white">סה"כ לקוח</span>
                    <span className="text-white">{formatCurrency(analysis.store_price_breakdown.total)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-white text-sm font-medium mb-3">פירוט עלויות שלי</h4>
                <div className="space-y-1">
                  {analysis.my_cost_breakdown.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-400">{item.name}</span>
                      <span className="text-white">{formatCurrency(item.amount_usd, 'USD')}</span>
                    </div>
                  ))}
                  {analysis.my_cost_breakdown.shipping_cost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">עלות משלוח</span>
                      <span className="text-white">{formatCurrency(analysis.my_cost_breakdown.shipping_cost, 'USD')}</span>
                    </div>
                  )}
                  {analysis.my_cost_breakdown.gift_capsule_cost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">קפסולות מתנה/הפתעה</span>
                      <span className="text-white">{formatCurrency(analysis.my_cost_breakdown.gift_capsule_cost, 'USD')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold border-t border-white/10 pt-1 mt-1">
                    <span className="text-white">סה"כ עלות</span>
                    <span className="text-white">{formatCurrency(analysis.my_cost_breakdown.total_usd, 'USD')} = {formatCurrency(analysis.my_cost_ils)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-white text-sm font-medium mb-3">חישוב רווח</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">הכנסה מהלקוח</span>
                    <span className="text-white">{formatCurrency(analysis.store_price_breakdown.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">עלות שלי</span>
                    <span className="text-red-400">-{formatCurrency(analysis.my_cost_ils)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-300">רווח גולמי</span>
                    <span className={getProfitColor(analysis.gross_profit_ils)}>{formatCurrency(analysis.gross_profit_ils)}</span>
                  </div>
                  {analysis.payment_fee_ils > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">עמלת תשלום ({analysis.payment_method})</span>
                      <span className="text-red-400">-{formatCurrency(analysis.payment_fee_ils)}</span>
                    </div>
                  )}
                  {analysis.vat_ils > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">מע"מ</span>
                      <span className="text-red-400">-{formatCurrency(analysis.vat_ils)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-1 mt-1">
                    <span className="text-white">רווח נקי</span>
                    <span className={getProfitColor(analysis.net_profit_ils)}>{formatCurrency(analysis.net_profit_ils)}</span>
                  </div>
                </div>
              </div>

              {analysis.discounts_applied.length > 0 && (
                <div>
                  <h4 className="text-white text-sm font-medium mb-3">הנחות שיושמו</h4>
                  <div className="space-y-1">
                    {analysis.discounts_applied.map((d, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-400">{d.name}</span>
                        <span className="text-yellow-400">-{formatCurrency(d.amount_ils)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.notes && (
                <div className="md:col-span-2">
                  <p className="text-gray-500 text-xs">{analysis.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-sm">
                {order.status === 'error' ? 'שגיאה בניתוח ההזמנה' : 'ההזמנה עדיין לא נותחה'}
              </p>
              {onReanalyze && (
                <Button size="sm" variant="outline" onClick={handleReanalyze} loading={reanalyzing}>
                  <RefreshCw className="w-3 h-3" />
                  נתח שוב
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
