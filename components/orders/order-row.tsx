'use client'

import { useState } from 'react'
import { ChevronDown, RefreshCw, TrendingUp, TrendingDown, Cpu, Bot, Package, Truck, CreditCard } from 'lucide-react'
import { OrderRow as OrderRowType, AIOrderAnalysis } from '@/types'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'

interface OrderRowProps {
  order: OrderRowType
  onReanalyze?: (orderId: string) => Promise<void>
}

function MarginBar({ value, max = 60 }: { value: number; max?: number }) {
  const pct    = Math.min(Math.max(value, 0), max) / max * 100
  const color  = value >= 30 ? 'var(--color-success)' : value >= 15 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
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
    <div
      className={cn('rounded-xl border overflow-hidden', isLoss ? 'tint-danger border-[var(--color-danger)]/30' : 'bg-[var(--color-bg-surface)] border-[var(--color-border)]')}
    >

      {/* ── Summary row ── */}
      <div
        className={cn(
          'flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors',
          isLoss ? 'hover:bg-[var(--color-danger)]/10' : 'hover:bg-[var(--color-bg-surface-alt)]'
        )}
        onClick={toggleExpand}
      >

        <ChevronDown className="w-4 h-4 shrink-0 transition-transform" style={{ color: 'var(--color-text-tertiary)', transform: expanded ? 'rotate(180deg)' : 'none' }} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-white text-sm font-bold">#{order.orderNumber}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
              {formatDate(order.orderDate)}
            </span>
            {order.customerName && <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>· {order.customerName}</span>}
            {order.paymentMethod && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)' }}>
                {order.paymentMethod}
              </span>
            )}
          </div>
          <p className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>{order.orderSummary ?? 'ממתין לניתוח...'}</p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          {order.storePrice != null && (
            <div className="text-right hidden sm:block">
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>הכנסה</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(order.storePrice)}</p>
            </div>
          )}
          {order.myCostIls != null && (
            <div className="text-right hidden md:block">
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>עלות</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>{formatCurrency(order.myCostIls)}</p>
            </div>
          )}
          {order.netProfitIls != null && (
            <div className="text-right">
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>רווח נקי</p>
              <div className="flex items-center gap-1 justify-end">
                {isLoss
                  ? <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                  : <TrendingUp   className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />}
                <p className="text-sm font-bold" style={{ color: isLoss ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {formatCurrency(order.netProfitIls)}
                </p>
              </div>
              {margin != null && <MarginBar value={margin} />}
            </div>
          )}

          <StatusBadge
            status={order.status}
            label={order.status === 'analyzed' ? '✓ נותח' : order.status === 'error' ? '✗ שגיאה' : '⏳ ממתין'}
          />
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t px-5 py-5 space-y-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-app)' }}>
          {loadingAnalysis ? (
            <div className="flex items-center gap-2 py-2" style={{ color: 'var(--color-text-tertiary)' }}>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">טוען פירוט...</span>
            </div>
          ) : analysis ? (
            <>
              {/* Source badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)' }}>
                  <Cpu className="w-3 h-3" />
                  חושב על-ידי מחשבון דטרמיניסטי
                </div>
                {onReanalyze && (
                  <button onClick={handleReanalyze} disabled={reanalyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ background: 'var(--color-border)', color: 'var(--color-brand-start)' }}>
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
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3"
                      style={{ background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)' }}>
                      <Package className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                        פירוט עלות מלא
                      </span>
                    </div>

                    <div className="divide-y" style={{ background: 'var(--color-bg-app)', borderColor: 'var(--color-bg-surface)' }}>

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
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
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
                                  <span style={{ color: 'var(--color-text-secondary)' }}>
                                    יחידה {ui + 1}
                                    {ui === 0 && item.quantity > 1 && (
                                      <span className="text-xs mr-1" style={{ color: 'var(--color-text-tertiary)' }}>(ראשונה)</span>
                                    )}
                                    {ui > 0 && (
                                      <span className="text-xs mr-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                        ({ui + 1}{ui === 1 ? 'ה' : 'ה'})
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-mono" style={{ color: 'var(--color-danger)' }}>
                                    ${item.unitCostUsd.toFixed(2)}
                                    <span className="text-xs mr-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                                      = ₪{(item.unitCostUsd * rate).toFixed(2)}
                                    </span>
                                  </span>
                                </div>
                              ))}
                              {/* Subtotal per product if qty > 1 */}
                              {item.quantity > 1 && (
                                <div className="flex items-center justify-between text-sm pt-1"
                                  style={{ borderTop: '1px dashed var(--color-border)' }}>
                                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    סה"כ {item.name.split(' ').slice(0, 2).join(' ')}
                                  </span>
                                  <span className="font-bold" style={{ color: 'var(--color-danger)' }}>
                                    ${item.totalCostUsd.toFixed(2)}
                                    <span className="text-xs mr-1.5 font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
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
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                              הנחת כמות מהסוכן
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                              {analysis.notes || `${Math.round(supplierDiscount / (analysis.my_cost_breakdown.items?.length ?? 1) * 10) / 10}$ ליחידה נוספת מאותו סוג`}
                            </p>
                          </div>
                          <span className="font-bold text-sm" style={{ color: 'var(--color-success)' }}>
                            -${supplierDiscount.toFixed(2)}
                            <span className="text-xs mr-1.5 font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                              = -₪{(supplierDiscount * rate).toFixed(2)}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Shipping cost */}
                      {shipCost > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>משלוח לבית (עלות לעסק)</p>
                          <span className="text-sm" style={{ color: 'var(--color-danger)' }}>
                            ${shipCost.toFixed(2)}
                            <span className="text-xs mr-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                              = ₪{(shipCost * rate).toFixed(2)}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Gift/surprise items */}
                      {giftItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5">
                          <div>
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.name} × {item.quantity}</p>
                            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                              {item.unitCostUsd === 0 ? 'חלק מהדיל — עלות $0' : `מתנה/הפתעה: $${item.unitCostUsd.toFixed(2)} ליחידה`}
                            </p>
                          </div>
                          <span className="text-sm" style={{ color: item.totalCostUsd === 0 ? 'var(--color-text-tertiary)' : 'var(--color-danger)' }}>
                            {item.totalCostUsd === 0 ? '$0.00' : `$${item.totalCostUsd.toFixed(2)}`}
                          </span>
                        </div>
                      ))}

                      {/* Grand total cost */}
                      <div className="flex items-center justify-between px-4 py-3"
                        style={{ background: 'var(--color-bg-surface)' }}>
                        <div>
                          <p className="font-bold text-sm text-white">סה"כ עלות</p>
                          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            ${rawItemCost.toFixed(2)} − ${supplierDiscount.toFixed(2)} הנחה + ${shipCost.toFixed(2)} משלוח
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm" style={{ color: 'var(--color-danger)' }}>
                            ${analysis.my_cost_breakdown.total_usd.toFixed(2)}
                          </p>
                          <p className="font-bold text-base" style={{ color: 'var(--color-danger)' }}>
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
                <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    <CreditCard className="w-3.5 h-3.5" /> פירוט הכנסה
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-text-secondary)' }}>סכום מוצרים</span>
                      <span className="text-white">{formatCurrency(analysis.store_price_breakdown.subtotal)}</span>
                    </div>
                    {analysis.discounts_applied.map((d, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-warning)' }}>הנחה: {d.name}</span>
                        <span style={{ color: 'var(--color-warning)' }}>-{formatCurrency(d.amount_ils)}</span>
                      </div>
                    ))}
                    {analysis.store_price_breakdown.shipping_customer > 0 && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-secondary)' }}>משלוח לבית</span>
                        <span className="text-white">{formatCurrency(analysis.store_price_breakdown.shipping_customer)}</span>
                      </div>
                    )}
                    {analysis.store_price_breakdown.pickup_fee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-secondary)' }}>עמלת נקודת איסוף</span>
                        <span className="text-white">{formatCurrency(analysis.store_price_breakdown.pickup_fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <span className="text-white">לקוח שילם</span>
                      <span style={{ color: 'var(--color-brand-start)' }}>{formatCurrency(analysis.store_price_breakdown.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Cost & profit */}
                <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    <Truck className="w-3.5 h-3.5" /> עלויות ורווח
                  </h4>
                  <div className="space-y-1.5">
                    {[
                      { label: 'הכנסה מלקוח',  val: analysis.store_price_breakdown.total,  color: 'var(--color-brand-start)', sign: '+' },
                      { label: `עלות מוצרים ($${analysis.my_cost_breakdown.total_usd.toFixed(2)})`, val: -analysis.my_cost_ils, color: 'var(--color-danger)', sign: '-' },
                      { label: 'רווח גולמי',    val: analysis.gross_profit_ils,             color: 'var(--color-success)', sign: '' },
                      { label: `עמלת תשלום (${analysis.payment_method})`, val: -analysis.payment_fee_ils, color: 'var(--color-warning)', sign: '-' },
                      ...(analysis.vat_ils > 0 ? [{ label: 'מע"מ', val: -analysis.vat_ils, color: 'var(--color-warning)', sign: '-' }] : []),
                    ].map((r, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span style={{ color: i === 2 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{r.label}</span>
                        <span className="font-medium" style={{ color: r.color }}>
                          {r.sign}{formatCurrency(Math.abs(r.val))}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <span className="text-white">רווח נקי</span>
                      <span className="text-base" style={{ color: analysis.net_profit_ils >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatCurrency(analysis.net_profit_ils)}
                        {order.storePrice && order.storePrice > 0 && (
                          <span className="text-xs font-normal mr-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                            ({((analysis.net_profit_ils / order.storePrice) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {analysis.notes && (
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{analysis.notes}</p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                {order.status === 'error' ? 'שגיאה בניתוח ההזמנה' : 'ההזמנה עדיין לא נותחה'}
              </p>
              {onReanalyze && (
                <button onClick={handleReanalyze} disabled={reanalyzing}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: 'var(--color-border)', color: 'var(--color-brand-start)' }}>
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
