'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Play, Save, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface ProductEntry {
  key: string
  productTitle: string
  variantTitle: string
  costUsd: number
  sellingPriceIls: number
}

interface PriceChange {
  id: string
  date: string
  productKey: string
  productTitle: string
  variantTitle: string
  mode: 'cost' | 'selling'
  oldValue: number
  newValue: number
  fromOrderNumber?: string
  note: string
}

interface Props {
  businessId: string
  products: ProductEntry[]
  priceHistory: PriceChange[]
  exchangeRate: number
  onSaveChange: (change: PriceChange, updateCost: boolean) => Promise<void>
}

const inputStyle: React.CSSProperties = {
  background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1',
  borderRadius: '10px', padding: '9px 14px', fontSize: '13px',
  outline: 'none', width: '100%',
}

export function PriceSimulationTab({ businessId, products, priceHistory, exchangeRate, onSaveChange }: Props) {
  const [mode, setMode]             = useState<'cost' | 'selling'>('cost')
  const [productKey, setProductKey] = useState(products[0]?.key ?? '')
  const [newValue, setNewValue]     = useState('')
  const [fromOrder, setFromOrder]   = useState('')
  const [toOrder, setToOrder]       = useState('')
  const [note, setNote]             = useState('')
  const [simResult, setSimResult]   = useState<any>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)

  const selectedProduct = products.find(p => p.key === productKey)

  async function runSimulation() {
    if (!newValue || !productKey) return
    setSimLoading(true)
    setSimError('')
    setSimResult(null)
    try {
      const body: any = { businessId, mode, productKey, fromOrderNumber: fromOrder || undefined, toOrderNumber: toOrder || undefined }
      if (mode === 'cost') body.newValueUsd = parseFloat(newValue)
      else body.newValueIls = parseFloat(newValue)

      const res = await fetch('/api/simulate/price-change', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setSimError(data.error); return }
      setSimResult(data)
    } catch (e: any) {
      setSimError(e?.message ?? 'שגיאה')
    } finally { setSimLoading(false) }
  }

  async function commitChange() {
    if (!selectedProduct || !newValue) return
    setSaving(true)
    const change: PriceChange = {
      id:           crypto.randomUUID(),
      date:         new Date().toISOString(),
      productKey,
      productTitle: selectedProduct.productTitle,
      variantTitle: selectedProduct.variantTitle,
      mode,
      oldValue:     mode === 'cost' ? selectedProduct.costUsd : selectedProduct.sellingPriceIls,
      newValue:     parseFloat(newValue),
      fromOrderNumber: fromOrder || undefined,
      note,
    }
    await onSaveChange(change, mode === 'cost')
    setSaving(false)
    setSimResult(null)
    setNewValue('')
    setNote('')
    setFromOrder('')
  }

  const currencyLabel = mode === 'cost' ? '$' : '₪'
  const oldValue = selectedProduct
    ? (mode === 'cost' ? selectedProduct.costUsd : selectedProduct.sellingPriceIls)
    : 0
  const diff = simResult?.totalDiff ?? 0

  return (
    <div className="space-y-6">

      {/* Form */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#13161F', border: '1px solid #1E2130' }}>
        <h3 className="text-white font-semibold">סימולציה ושינוי מחיר</h3>

        {/* Mode toggle */}
        <div className="flex rounded-xl p-1 gap-1" style={{ background: '#0D0F14', border: '1px solid #1E2130' }}>
          {([['cost','💰 שינוי עלות ספק'], ['selling','💸 שינוי מחיר מכירה']] as const).map(([val, label]) => (
            <button key={val} onClick={() => { setMode(val); setSimResult(null) }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: mode === val ? '#1E2846' : 'transparent', color: mode === val ? '#4F6EF7' : '#6B7280' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Product */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: '#CBD5E1' }}>מוצר</label>
          <select value={productKey} onChange={e => { setProductKey(e.target.value); setSimResult(null) }}
            style={{ ...inputStyle, direction: 'rtl' }}>
            {products.map(p => (
              <option key={p.key} value={p.key}>
                {p.productTitle}{p.variantTitle !== 'Default Title' ? ` / ${p.variantTitle}` : ''}
                {mode === 'cost' ? ` (עלות: $${p.costUsd})` : ` (מחיר: ₪${p.sellingPriceIls})`}
              </option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: '#CBD5E1' }}>
              {mode === 'cost' ? 'עלות נוכחית' : 'מחיר נוכחי'}
            </label>
            <div className="rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: '#0D0F14', border: '1px solid #1E2130', color: '#6B7280' }}>
              {currencyLabel}{oldValue}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: '#CBD5E1' }}>
              {mode === 'cost' ? 'עלות חדשה ($)' : 'מחיר חדש (₪)'}
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#4A5174' }}>{currencyLabel}</span>
              <input type="number" step="0.01" value={newValue} onChange={e => { setNewValue(e.target.value); setSimResult(null) }}
                placeholder="0.00" style={{ ...inputStyle, paddingRight: '26px' }} dir="ltr" />
            </div>
          </div>
        </div>

        {/* Order range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: '#CBD5E1' }}>מהזמנה # (ריק = כל ההזמנות)</label>
            <input type="text" value={fromOrder} onChange={e => { setFromOrder(e.target.value); setSimResult(null) }}
              placeholder="3500" style={inputStyle} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: '#CBD5E1' }}>עד הזמנה # (ריק = הכל)</label>
            <input type="text" value={toOrder} onChange={e => { setToOrder(e.target.value); setSimResult(null) }}
              placeholder="4200" style={inputStyle} dir="ltr" />
          </div>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: '#CBD5E1' }}>סיבת השינוי (לרישום היסטוריה)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="עליית מחיר ספק / עליית מחיר באתר / שינוי מבצע..." style={inputStyle} />
        </div>

        {simError && <p className="text-sm px-3 py-2 rounded-xl" style={{ background: '#2D0F0F', color: '#FCA5A5' }}>{simError}</p>}

        <div className="flex gap-3">
          <button onClick={runSimulation} disabled={simLoading || !newValue || !productKey}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg,#4F6EF7,#7C5CFC)' }}>
            <Play className="w-4 h-4" />
            {simLoading ? 'מחשב...' : 'הרץ סימולציה'}
          </button>
          {simResult && (
            <button onClick={commitChange} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
              style={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)' }}>
              <Save className="w-4 h-4" />
              {saving ? 'שומר...' : 'שמור שינוי'}
            </button>
          )}
        </div>
      </div>

      {/* Simulation result */}
      {simResult && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${diff >= 0 ? '#166534' : '#7F1D1D'}` }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ background: diff >= 0 ? '#0D2818' : '#1A0A0A' }}>
            <div className="flex items-center gap-2">
              {diff >= 0
                ? <TrendingUp className="w-5 h-5" style={{ color: '#22C55E' }} />
                : <TrendingDown className="w-5 h-5" style={{ color: '#EF4444' }} />}
              <span className="font-semibold" style={{ color: diff >= 0 ? '#22C55E' : '#EF4444' }}>
                {diff >= 0 ? '↑ שיפור ברווח' : '↓ ירידה ברווח'}
              </span>
            </div>
            <span className="text-2xl font-black" style={{ color: diff >= 0 ? '#22C55E' : '#EF4444' }}>
              {diff >= 0 ? '+' : ''}₪{diff.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/5 px-0 py-4" style={{ background: '#0D0F14' }}>
            {[
              { label: 'הזמנות שנסרקו', val: String(simResult.totalOrders) },
              { label: 'הזמנות שהושפעו', val: String(simResult.ordersAffected) },
              { label: 'רווח קודם', val: `₪${simResult.originalTotalProfit?.toFixed(2)}` },
            ].map(s => (
              <div key={s.label} className="text-center px-4">
                <p className="text-lg font-bold text-white">{s.val}</p>
                <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>{s.label}</p>
              </div>
            ))}
          </div>
          {simResult.rows?.length > 0 && (
            <div className="border-t" style={{ borderColor: '#1E2130' }}>
              <div className="px-4 py-2 text-xs font-semibold uppercase" style={{ background: '#13161F', color: '#4A5174' }}>
                פירוט ({simResult.rows.length} הזמנות ראשונות שהושפעו)
              </div>
              <div className="max-h-48 overflow-y-auto">
                {simResult.rows.map((r: any) => (
                  <div key={r.orderNumber} className="flex items-center justify-between px-4 py-2 border-b text-sm"
                    style={{ borderColor: '#0D0F14' }}>
                    <span className="font-mono" style={{ color: '#CBD5E1' }}>#{r.orderNumber}</span>
                    <div className="flex items-center gap-4">
                      <span style={{ color: '#6B7280' }}>₪{r.origProfit.toFixed(2)}</span>
                      <span style={{ color: '#4A5174' }}>→</span>
                      <span style={{ color: r.simProfit >= r.origProfit ? '#22C55E' : '#EF4444' }}>₪{r.simProfit.toFixed(2)}</span>
                      <span className="text-xs" style={{ color: r.diff >= 0 ? '#22C55E' : '#EF4444' }}>
                        {r.diff >= 0 ? '+' : ''}₪{r.diff.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1E2130' }}>
        <button className="w-full flex items-center justify-between px-5 py-4"
          style={{ background: '#13161F' }}
          onClick={() => setHistoryOpen(v => !v)}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: '#4A5174' }} />
            <span className="font-semibold text-white text-sm">היסטוריית שינויי מחירים</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1E2130', color: '#6B7280' }}>
              {priceHistory.length}
            </span>
          </div>
          {historyOpen ? <ChevronUp className="w-4 h-4" style={{ color: '#4A5174' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#4A5174' }} />}
        </button>

        {historyOpen && (
          priceHistory.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: '#4A5174', background: '#0D0F14' }}>
              אין עדיין שינויי מחירים רשומים
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#1E2130', background: '#0D0F14' }}>
              {[...priceHistory].reverse().map(ch => (
                <div key={ch.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {ch.productTitle}{ch.variantTitle !== 'Default Title' ? ` / ${ch.variantTitle}` : ''}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: ch.mode === 'cost' ? '#1E2846' : '#2A1800',
                          color: ch.mode === 'cost' ? '#4F6EF7' : '#F59E0B',
                        }}>
                          {ch.mode === 'cost' ? 'עלות ספק' : 'מחיר מכירה'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span style={{ color: '#6B7280' }}>
                          {ch.mode === 'cost' ? '$' : '₪'}{ch.oldValue}
                        </span>
                        <span style={{ color: '#4A5174' }}>→</span>
                        <span className="font-semibold" style={{ color: ch.newValue > ch.oldValue ? (ch.mode === 'cost' ? '#EF4444' : '#22C55E') : (ch.mode === 'cost' ? '#22C55E' : '#EF4444') }}>
                          {ch.mode === 'cost' ? '$' : '₪'}{ch.newValue}
                        </span>
                        {ch.fromOrderNumber && (
                          <span className="text-xs" style={{ color: '#4A5174' }}>מהזמנה #{ch.fromOrderNumber}</span>
                        )}
                      </div>
                      {ch.note && <p className="text-xs mt-1" style={{ color: '#4A5174' }}>{ch.note}</p>}
                    </div>
                    <span className="text-xs shrink-0" style={{ color: '#374151' }}>
                      {new Date(ch.date).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
