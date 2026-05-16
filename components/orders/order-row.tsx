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
  const [expanded, setExpanded]       = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [analysis, setAnalysis]       = useState<AIOrderAnalysis | null>(
    order.aiAnalysis as AIOrderAnalysis | null ?? null
  )
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)

  async function toggleExpand() {
    if (!expanded && !analysis && order.status === 'analyzed') {
      setLoadingAnalysis(true)
      try {
        const res = await fetch(`/api/orders/${order.id}`)
        const data = await res.json()
        if (data.aiAnalysis) setAnalysis(data.aiAnalysis as AIOrderAnalysis)
      } finally {
        setLoadingAnalysis(false)
      }
    }
    setExpanded(v => !v)
  }
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
        onClick={toggleExpand}
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

              {/* ── Full cost breakdown ── */}
              {(() => {
                const rate        = analysis.exchange_rate_used ?? 3.7
                const mainItems   = analysis.line_items_parsed.filter(i => !i.isGift)
                const giftItems   = analysis.line_items_parsed.filter(i => i.isGift)
                const rawItemCost = mainItems.reduce((s, i) => s + i.totalCostUsd, 0)
                const giftCost    = analysis.my_cost_breakdown.gift_capsule_cost ?? 0
                const shipCost    = analysis.my_cost_breakdown.shipping_cost ?? 0
                const supplierDiscount = Math.max(0,
                  parseFloat((rawItemCost - (analysis.my_cost_breakdown.total_usd - shipCost - giftCost)).toFixed(4))
                )
                return (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1E2130' }}>
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3"
                      style={{ background: '#13161F', borderBottom: '1px solid #1E2130' }}>
                      <Package className="w-4 h-4" style={{ color: '#4A5174' }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A5174' }}>
                        פירוט עלות מלא
                      </span>
                    </div>

                    <div className="divide-y" style={{ background: '#0D0F14', borderColor: '#13161F' }}>

                      {/* Main products */}
                      {mainItems.map((item, i) => {
                        const itemMargin = item.unitPriceIls > 0
                          ? ((item.unitPriceIls - item.unitCostUsd * rate) / item.unitPriceIls) * 100
                          : 0
                        return (
                          <div key={i} className="px-4 py-3">
                            {/* Product name + selling price */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="text-sm font-semibold text-white">{item.name}</p>
                                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                                  מחיר מכירה: {item.unitPriceIls > 0 ? formatCurrency(item.unitPriceIls) : '₪0 (מתנה ללקוח)'} × {item.quantity}
                                </p>
                              </div>
                              {!item.isGift && item.unitPriceIls > 0 && (
                                <MarginBar value={itemMargin} />
                              )}
                            </div>

                            {/* Cost per unit — show each unit if qty > 1 */}
                            <div className="space-y-1 mr-2">
                              {Array.from({ length: item.quantity }, (_, ui) => (
                                <div key={ui} className="flex items-center justify-between text-sm">
                                  <span style={{ color: '#8B8FA8' }}>
                                    יחידה {ui + 1}
                                    {ui === 0 && item.quantity > 1 && (
                                      <span className="text-xs mr-1" style={{ color: '#4A5174' }}>(ראשונה)</span>
                                    )}
                                    {ui > 0 && (
                                      <span className="text-xs mr-1" style={{ color: '#4A5174' }}>
                                        ({ui + 1}{ui === 1 ? 'ה' : 'ה'})
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-mono" style={{ color: '#EF4444' }}>
                                    ${item.unitCostUsd.toFixed(2)}
                                    <span className="text-xs mr-1.5" style={{ color: '#4A5174' }}>
                                      = ₪{(item.unitCostUsd * rate).toFixed(2)}
                                    </span>
                                  </span>
                                </div>
                              ))}
                              {/* Subtotal per product if qty > 1 */}
                              {item.quantity > 1 && (
                                <div className="flex items-center justify-between text-sm pt-1"
                                  style={{ borderTop: '1px dashed #1E2130' }}>
                                  <span className="font-medium" style={{ color: '#CBD5E1' }}>
                                    סה"כ {item.name.split(' ').slice(0, 2).join(' ')}
                                  </span>
                                  <span className="font-bold" style={{ color: '#EF4444' }}>
                                    ${item.totalCostUsd.toFixed(2)}
                                    <span className="text-xs mr-1.5 font-normal" style={{ color: '#4A5174' }}>
                                      = ₪{(item.totalCostUsd * rate).toFixed(2)}
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {/* Supplier quantity discount */}
                      {supplierDiscount > 0.01 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#22C55E' }}>
                              הנחת כמות מהסוכן
                            </p>
                            <p className="text-xs" style={{ color: '#4A5174' }}>
                              {analysis.notes || `${Math.round(supplierDiscount / (analysis.my_cost_breakdown.items?.length ?? 1) * 10) / 10}$ ליחידה נוספת מאותו סוג`}
                            </p>
                          </div>
                          <span className="font-bold text-sm" style={{ color: '#22C55E' }}>
                            -${supplierDiscount.toFixed(2)}
                            <span className="text-xs mr-1.5 font-normal" style={{ color: '#4A5174' }}>
                              = -₪{(supplierDiscount * rate).toFixed(2)}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Shipping cost */}
                      {shipCost > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="text-sm" style={{ color: '#8B8FA8' }}>משלוח לבית (עלות לעסק)</p>
                          <span className="text-sm" style={{ color: '#EF4444' }}>
                            ${shipCost.toFixed(2)}
                            <span className="text-xs mr-1.5" style={{ color: '#4A5174' }}>
                              = ₪{(shipCost * rate).toFixed(2)}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Gift/surprise items */}
                      {giftItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5">
                          <div>
                            <p className="text-sm" style={{ color: '#8B8FA8' }}>{item.name} × {item.quantity}</p>
                            <p className="text-xs" style={{ color: '#4A5174' }}>
                              {item.unitCostUsd === 0 ? 'חלק מהדיל — עלות $0' : `מתנה/הפתעה: $${item.unitCostUsd.toFixed(2)} ליחידה`}
                            </p>
                          </div>
                          <span className="text-sm" style={{ color: item.totalCostUsd === 0 ? '#374151' : '#EF4444' }}>
                            {item.totalCostUsd === 0 ? '$0.00' : `$${item.totalCostUsd.toFixed(2)}`}
                          </span>
                        </div>
                      ))}

                      {/* Grand total cost */}
                      <div className="flex items-center justify-between px-4 py-3"
                        style={{ background: '#13161F' }}>
                        <div>
                          <p className="font-bold text-sm text-white">סה"כ עלות</p>
                          <p className="text-xs" style={{ color: '#4A5174' }}>
                            ${rawItemCost.toFixed(2)} − ${supplierDiscount.toFixed(2)} הנחה + ${shipCost.toFixed(2)} משלוח
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm" style={{ color: '#EF4444' }}>
                            ${analysis.my_cost_breakdown.total_usd.toFixed(2)}
                          </p>
                          <p className="font-bold text-base" style={{ color: '#EF4444' }}>
                            ₪{analysis.my_cost_ils.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

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
