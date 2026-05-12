'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { OrderRow as OrderRowType, AIOrderAnalysis } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface OrderRowProps {
  order: OrderRowType
  onReanalyze?: (orderId: string) => Promise<void>
}

const PM_LABELS: Record<string, string> = { 'Bit': 'Bit', 'כרטיס אשראי': 'אשראי', 'PayPal': 'PayPal', 'Cash': 'מזומן' }

export function OrderRowComponent({ order, onReanalyze }: OrderRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const analysis = order.aiAnalysis as AIOrderAnalysis | null
  const profit = order.netProfitIls ?? 0
  const isLoss = profit < 0
  const margin = order.storePrice && order.storePrice > 0 ? (profit / order.storePrice) * 100 : null

  async function handleReanalyze(e: React.MouseEvent) {
    e.stopPropagation()
    if (!onReanalyze) return
    setReanalyzing(true)
    try { await onReanalyze(order.id) } finally { setReanalyzing(false) }
  }

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all cursor-pointer"
      style={{ background: isLoss ? '#1A0F0F' : '#13161F', borderColor: isLoss ? '#3B1515' : '#1E2130' }}
    >
      {/* Row */}
      <div
        className="flex items-center gap-4 px-4 py-3.5"
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={e => (e.currentTarget.style.background = isLoss ? '#1F1212' : '#181B27')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <ChevronDown className="w-4 h-4 shrink-0 transition-transform" style={{ color: '#4A5174', transform: expanded ? 'rotate(180deg)' : 'none' }} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white text-sm font-semibold">#{order.orderNumber}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1E2130', color: '#6B7280' }}>
              {formatDate(order.orderDate)}
            </span>
            {order.customerName && <span className="text-xs" style={{ color: '#4A5174' }}>• {order.customerName}</span>}
          </div>
          <p className="text-sm truncate" style={{ color: '#8B8FA8' }}>
            {order.orderSummary ?? 'ממתין לניתוח...'}
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          {order.storePrice != null && (
            <div className="text-right hidden sm:block">
              <p className="text-xs mb-0.5" style={{ color: '#4A5174' }}>הכנסה</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(order.storePrice)}</p>
            </div>
          )}
          {order.myCostIls != null && (
            <div className="text-right hidden md:block">
              <p className="text-xs mb-0.5" style={{ color: '#4A5174' }}>עלות</p>
              <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>{formatCurrency(order.myCostIls)}</p>
            </div>
          )}
          {order.netProfitIls != null && (
            <div className="text-right">
              <p className="text-xs mb-0.5" style={{ color: '#4A5174' }}>רווח נקי</p>
              <div className="flex items-center gap-1 justify-end">
                {isLoss ? <TrendingDown className="w-3.5 h-3.5" style={{ color: '#EF4444' }} /> : <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22C55E' }} />}
                <p className="text-sm font-bold" style={{ color: isLoss ? '#EF4444' : '#22C55E' }}>
                  {formatCurrency(order.netProfitIls)}
                </p>
              </div>
              {margin != null && (
                <p className="text-xs mt-0.5 text-right" style={{ color: isLoss ? '#7F2020' : '#166534' }}>
                  {margin.toFixed(1)}% מרווח
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {order.paymentMethod && (
              <span className="text-xs px-2 py-1 rounded-lg" style={{ background: '#1A1D2A', color: '#6B7280' }}>
                {PM_LABELS[order.paymentMethod] ?? order.paymentMethod}
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded-lg" style={{
              background: order.status === 'analyzed' ? '#0D2818' : order.status === 'error' ? '#2D0F0F' : '#1A1D2A',
              color: order.status === 'analyzed' ? '#22C55E' : order.status === 'error' ? '#EF4444' : '#6B7280',
            }}>
              {order.status === 'analyzed' ? '✓ נותח' : order.status === 'error' ? '✗ שגיאה' : '⏳ ממתין'}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t px-4 py-5" style={{ borderColor: '#1E2130', background: '#0D0F14' }}>
          {analysis ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Customer price */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A5174' }}>פירוט ללקוח</h4>
                <div className="space-y-2">
                  {analysis.store_price_breakdown.items.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-sm" style={{ color: '#8B8FA8' }}>{item.name}</span>
                      <span className="text-sm text-white">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  {analysis.store_price_breakdown.shipping_customer > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: '#8B8FA8' }}>משלוח</span>
                      <span className="text-sm text-white">{formatCurrency(analysis.store_price_breakdown.shipping_customer)}</span>
                    </div>
                  )}
                  {analysis.store_price_breakdown.pickup_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: '#8B8FA8' }}>עמלת נ. איסוף</span>
                      <span className="text-sm text-white">{formatCurrency(analysis.store_price_breakdown.pickup_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t font-semibold" style={{ borderColor: '#1E2130' }}>
                    <span className="text-sm text-white">סה"כ</span>
                    <span className="text-sm text-white">{formatCurrency(analysis.store_price_breakdown.total)}</span>
                  </div>
                </div>
              </div>

              {/* My costs */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A5174' }}>עלויות שלי</h4>
                <div className="space-y-2">
                  {analysis.my_cost_breakdown.items.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-sm" style={{ color: '#8B8FA8' }}>{item.name}</span>
                      <span className="text-sm text-white">{formatCurrency(item.amount_usd, 'USD')}</span>
                    </div>
                  ))}
                  {analysis.my_cost_breakdown.shipping_cost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: '#8B8FA8' }}>משלוח</span>
                      <span className="text-sm text-white">{formatCurrency(analysis.my_cost_breakdown.shipping_cost, 'USD')}</span>
                    </div>
                  )}
                  {analysis.my_cost_breakdown.gift_capsule_cost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: '#8B8FA8' }}>קפסולות מתנה</span>
                      <span className="text-sm text-white">{formatCurrency(analysis.my_cost_breakdown.gift_capsule_cost, 'USD')}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t font-semibold" style={{ borderColor: '#1E2130' }}>
                    <span className="text-sm text-white">סה"כ</span>
                    <span className="text-sm" style={{ color: '#EF4444' }}>{formatCurrency(analysis.my_cost_ils)}</span>
                  </div>
                </div>
              </div>

              {/* P&L */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A5174' }}>רווח והפסד</h4>
                <div className="space-y-2">
                  {[
                    { label: 'הכנסה', val: analysis.store_price_breakdown.total, color: '#4F6EF7' },
                    { label: 'עלות', val: -analysis.my_cost_ils, color: '#EF4444' },
                    { label: 'רווח גולמי', val: analysis.gross_profit_ils, color: '#22C55E' },
                    { label: 'עמלת תשלום', val: -analysis.payment_fee_ils, color: '#F59E0B' },
                    { label: 'מע"מ', val: -analysis.vat_ils, color: '#F59E0B' },
                  ].map(r => r.val !== 0 && (
                    <div key={r.label} className="flex justify-between">
                      <span className="text-sm" style={{ color: '#8B8FA8' }}>{r.label}</span>
                      <span className="text-sm font-medium" style={{ color: r.color }}>
                        {r.val >= 0 ? '+' : ''}{formatCurrency(Math.abs(r.val))}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t" style={{ borderColor: '#1E2130' }}>
                    <span className="text-sm font-bold text-white">רווח נקי</span>
                    <span className="text-sm font-bold" style={{ color: analysis.net_profit_ils >= 0 ? '#22C55E' : '#EF4444' }}>
                      {formatCurrency(analysis.net_profit_ils)}
                    </span>
                  </div>
                </div>

                {analysis.discounts_applied.length > 0 && (
                  <div className="mt-4 pt-3 border-t" style={{ borderColor: '#1E2130' }}>
                    <h5 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#4A5174' }}>הנחות</h5>
                    {analysis.discounts_applied.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span style={{ color: '#8B8FA8' }}>{d.name}</span>
                        <span style={{ color: '#F59E0B' }}>-{formatCurrency(d.amount_ils)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: '#4A5174' }}>
                {order.status === 'error' ? 'שגיאה בניתוח ההזמנה' : 'ההזמנה עדיין לא נותחה'}
              </p>
              {onReanalyze && (
                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ background: '#1E2130', color: '#4F6EF7' }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reanalyzing ? 'animate-spin' : ''}`} />
                  נתח שוב
                </button>
              )}
            </div>
          )}
          {analysis?.notes && (
            <p className="mt-3 text-xs" style={{ color: '#4A5174' }}>{analysis.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}
