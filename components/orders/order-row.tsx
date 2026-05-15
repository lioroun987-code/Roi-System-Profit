'use client'

import { useState } from 'react'
import { ChevronDown, RefreshCw, TrendingUp, TrendingDown, Cpu, Bot, Package, Truck, CreditCard } from 'lucide-react'
import { OrderRow as OrderRowType, AIOrderAnalysis } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface OrderRowProps {
  order: OrderRowType
  onReanalyze?: (orderId: string) => Promise<void>
}

function MarginBar({ value, max = 60 }: { value: number; max?: number }) {
  const pct    = Math.min(Math.max(value, 0), max) / max * 100
  const color  = value >= 30 ? '#22C55E' : value >= 15 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#1E2130' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>{value.toFixed(0)}%</span>
    </div>
  )
}

export function OrderRowComponent({ order, onReanalyze }: OrderRowProps) {
  const [expanded, setExpanded]     = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)

  const analysis  = order.aiAnalysis as AIOrderAnalysis | null
  const profit    = order.netProfitIls ?? 0
  const isLoss    = profit < 0
  const margin    = order.storePrice && order.storePrice > 0 ? (profit / order.storePrice) * 100 : null

  async function handleReanalyze(e: React.MouseEvent) {
    e.stopPropagation()
    if (!onReanalyze) return
    setReanalyzing(true)
    try { await onReanalyze(order.id) } finally { setReanalyzing(false) }
  }

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: isLoss ? '#1A0F0F' : '#13161F', borderColor: isLoss ? '#3B1515' : '#1E2130' }}>

      {/* ── Summary row ── */}
      <div className="flex items-center gap-4 px-4 py-3.5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
        onMouseEnter={e => (e.currentTarget.style.background = isLoss ? '#1F1212' : '#181B27')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

        <ChevronDown className="w-4 h-4 shrink-0 transition-transform" style={{ color: '#4A5174', transform: expanded ? 'rotate(180deg)' : 'none' }} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-white text-sm font-bold">#{order.orderNumber}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1E2130', color: '#6B7280' }}>
              {formatDate(order.orderDate)}
            </span>
            {order.customerName && <span className="text-xs" style={{ color: '#4A5174' }}>· {order.customerName}</span>}
            {order.paymentMethod && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#13161F', color: '#4A5174', border: '1px solid #1E2130' }}>
                {order.paymentMethod}
              </span>
            )}
          </div>
          <p className="text-sm truncate" style={{ color: '#8B8FA8' }}>{order.orderSummary ?? 'ממתין לניתוח...'}</p>
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
                {isLoss
                  ? <TrendingDown className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                  : <TrendingUp   className="w-3.5 h-3.5" style={{ color: '#22C55E' }} />}
                <p className="text-sm font-bold" style={{ color: isLoss ? '#EF4444' : '#22C55E' }}>
                  {formatCurrency(order.netProfitIls)}
                </p>
              </div>
              {margin != null && <MarginBar value={margin} />}
            </div>
          )}

          <span className="text-xs px-2 py-1 rounded-lg" style={{
            background: order.status === 'analyzed' ? '#0D2818' : order.status === 'error' ? '#2D0F0F' : '#1A1D2A',
            color:      order.status === 'analyzed' ? '#22C55E' : order.status === 'error' ? '#EF4444' : '#6B7280',
          }}>
            {order.status === 'analyzed' ? '✓ נותח' : order.status === 'error' ? '✗ שגיאה' : '⏳ ממתין'}
          </span>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t px-5 py-5 space-y-5" style={{ borderColor: '#1E2130', background: '#0D0F14' }}>
          {analysis ? (
            <>
              {/* Source badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: '#13161F', border: '1px solid #1E2130', color: '#4A5174' }}>
                  <Cpu className="w-3 h-3" />
                  חושב על-ידי מחשבון דטרמיניסטי
                </div>
                {onReanalyze && (
                  <button onClick={handleReanalyze} disabled={reanalyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ background: '#1E2130', color: '#4F6EF7' }}>
                    <RefreshCw className={`w-3 h-3 ${reanalyzing ? 'animate-spin' : ''}`} />
                    נתח מחדש
                  </button>
                )}
              </div>

              {/* Line items per product */}
              {analysis.line_items_parsed.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: '#4A5174' }}>
                    <Package className="w-3.5 h-3.5" /> מוצרים
                  </h4>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E2130' }}>
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold uppercase"
                      style={{ background: '#13161F', color: '#4A5174', borderBottom: '1px solid #1E2130' }}>
                      <span className="col-span-4">מוצר</span>
                      <span className="col-span-1 text-center">כמות</span>
                      <span className="col-span-2 text-right">מחיר יחידה</span>
                      <span className="col-span-2 text-right">עלות יחידה</span>
                      <span className="col-span-3 text-right">מרווח</span>
                    </div>
                    {analysis.line_items_parsed.map((item, i) => {
                      const itemMargin = item.unitPriceIls > 0
                        ? ((item.unitPriceIls - item.unitCostUsd * (analysis.exchange_rate_used ?? 3.7)) / item.unitPriceIls) * 100
                        : 0
                      return (
                        <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
                          style={{ borderBottom: i < analysis.line_items_parsed.length - 1 ? '1px solid #13161F' : 'none' }}>
                          <div className="col-span-4">
                            <p className="text-sm text-white leading-tight">{item.name}</p>
                            {item.isGift && (
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#2A1800', color: '#F59E0B' }}>מתנה</span>
                            )}
                          </div>
                          <span className="col-span-1 text-center text-sm" style={{ color: '#CBD5E1' }}>×{item.quantity}</span>
                          <span className="col-span-2 text-right text-sm" style={{ color: '#CBD5E1' }}>
                            {item.isGift ? '₪0' : `₪${item.unitPriceIls.toFixed(0)}`}
                          </span>
                          <span className="col-span-2 text-right text-sm" style={{ color: '#EF4444' }}>
                            <span className="font-semibold">${item.unitCostUsd.toFixed(2)}</span>
                            <span className="text-xs mr-1" style={{ color: '#4A5174' }}>
                              = ₪{(item.unitCostUsd * (analysis.exchange_rate_used ?? 3.7)).toFixed(1)}
                            </span>
                          </span>
                          <div className="col-span-3 flex justify-end">
                            {!item.isGift && item.unitPriceIls > 0
                              ? <MarginBar value={itemMargin} />
                              : <span className="text-xs" style={{ color: '#4A5174' }}>—</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* P&L breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Revenue breakdown */}
                <div className="rounded-xl p-4 space-y-2" style={{ background: '#13161F', border: '1px solid #1E2130' }}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: '#4A5174' }}>
                    <CreditCard className="w-3.5 h-3.5" /> פירוט הכנסה
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: '#8B8FA8' }}>סכום מוצרים</span>
                      <span className="text-white">{formatCurrency(analysis.store_price_breakdown.subtotal)}</span>
                    </div>
                    {analysis.discounts_applied.map((d, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span style={{ color: '#F59E0B' }}>הנחה: {d.name}</span>
                        <span style={{ color: '#F59E0B' }}>-{formatCurrency(d.amount_ils)}</span>
                      </div>
                    ))}
                    {analysis.store_price_breakdown.shipping_customer > 0 && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: '#8B8FA8' }}>משלוח לבית</span>
                        <span className="text-white">{formatCurrency(analysis.store_price_breakdown.shipping_customer)}</span>
                      </div>
                    )}
                    {analysis.store_price_breakdown.pickup_fee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: '#8B8FA8' }}>עמלת נקודת איסוף</span>
                        <span className="text-white">{formatCurrency(analysis.store_price_breakdown.pickup_fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: '1px solid #1E2130' }}>
                      <span className="text-white">לקוח שילם</span>
                      <span style={{ color: '#4F6EF7' }}>{formatCurrency(analysis.store_price_breakdown.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Cost & profit */}
                <div className="rounded-xl p-4 space-y-2" style={{ background: '#13161F', border: '1px solid #1E2130' }}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: '#4A5174' }}>
                    <Truck className="w-3.5 h-3.5" /> עלויות ורווח
                  </h4>
                  <div className="space-y-1.5">
                    {[
                      { label: 'הכנסה מלקוח',  val: analysis.store_price_breakdown.total,  color: '#4F6EF7', sign: '+' },
                      { label: `עלות מוצרים ($${analysis.my_cost_breakdown.total_usd.toFixed(2)})`, val: -analysis.my_cost_ils, color: '#EF4444', sign: '-' },
                      { label: 'רווח גולמי',    val: analysis.gross_profit_ils,             color: '#22C55E', sign: '' },
                      { label: `עמלת תשלום (${analysis.payment_method})`, val: -analysis.payment_fee_ils, color: '#F59E0B', sign: '-' },
                      ...(analysis.vat_ils > 0 ? [{ label: 'מע"מ', val: -analysis.vat_ils, color: '#F59E0B', sign: '-' }] : []),
                    ].map((r, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span style={{ color: i === 2 ? '#22C55E' : '#8B8FA8' }}>{r.label}</span>
                        <span className="font-medium" style={{ color: r.color }}>
                          {r.sign}{formatCurrency(Math.abs(r.val))}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-2" style={{ borderTop: '1px solid #1E2130' }}>
                      <span className="text-white">רווח נקי</span>
                      <span className="text-base" style={{ color: analysis.net_profit_ils >= 0 ? '#22C55E' : '#EF4444' }}>
                        {formatCurrency(analysis.net_profit_ils)}
                        {order.storePrice && order.storePrice > 0 && (
                          <span className="text-xs font-normal mr-1.5" style={{ color: '#4A5174' }}>
                            ({((analysis.net_profit_ils / order.storePrice) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {analysis.notes && (
                <p className="text-xs" style={{ color: '#4A5174' }}>{analysis.notes}</p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: '#4A5174' }}>
                {order.status === 'error' ? 'שגיאה בניתוח ההזמנה' : 'ההזמנה עדיין לא נותחה'}
              </p>
              {onReanalyze && (
                <button onClick={handleReanalyze} disabled={reanalyzing}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: '#1E2130', color: '#4F6EF7' }}>
                  <Bot className={`w-3.5 h-3.5 ${reanalyzing ? 'animate-spin' : ''}`} />
                  נתח עם AI
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
