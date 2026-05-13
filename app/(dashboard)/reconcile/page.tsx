'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Download, Search, ChevronDown, ChevronUp } from 'lucide-react'

interface ReconcileResult {
  orderNumber: string
  agentCost: number
  ourCost: number | null
  diff: number
  status: 'match' | 'agent_higher' | 'we_higher' | 'missing_our_cost' | 'missing_in_agent'
}

interface Summary {
  total: number
  matches: number
  agentHigher: number
  weHigher: number
  missingCost: number
  totalDiff: number
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  match:            { label: 'תואם',                  color: '#22C55E', bg: '#0D2818', icon: CheckCircle },
  agent_higher:     { label: 'סוכן חייב פחות',        color: '#F59E0B', bg: '#2A1800', icon: AlertTriangle },
  we_higher:        { label: 'חישוב שלנו גבוה',       color: '#F97316', bg: '#2A1200', icon: AlertTriangle },
  missing_our_cost: { label: 'חסרה עלות אצלנו',       color: '#6B7280', bg: '#1A1D2A', icon: XCircle },
  missing_in_agent: { label: 'חסר בגיליון סוכן',      color: '#8B5CF6', bg: '#1A1040', icon: XCircle },
}

export default function ReconcilePage() {
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [ourSheetId, setOurSheetId]       = useState('')
  const [agentSheetId, setAgentSheetId]   = useState('')
  const [agentSheetName, setAgentSheetName] = useState('')
  const [running, setRunning]             = useState(false)
  const [results, setResults]             = useState<ReconcileResult[] | null>(null)
  const [summary, setSummary]             = useState<Summary | null>(null)
  const [error, setError]                 = useState('')
  const [filter, setFilter]               = useState<'all' | 'issues' | 'match'>('all')
  const [search, setSearch]               = useState('')
  const [sortBy, setSortBy]               = useState<'diff' | 'order'>('diff')
  const [sortDir, setSortDir]             = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    const stored = localStorage.getItem('activeBusiness')
    if (stored) {
      setActiveBusiness(stored)
      fetch(`/api/businesses/${stored}`)
        .then(r => r.json())
        .then(b => { if (b.googleSheetsId) setOurSheetId(b.googleSheetsId) })
        .catch(() => {})
    }
    const handler = (e: CustomEvent) => setActiveBusiness(e.detail)
    window.addEventListener('businessChange', handler as EventListener)
    return () => window.removeEventListener('businessChange', handler as EventListener)
  }, [])

  async function runReconcile() {
    if (!activeBusiness) { setError('בחר עסק מהתפריט הצדדי'); return }
    if (!agentSheetId.trim()) { setError('יש להכניס את מזהה גיליון הסוכן'); return }
    if (!ourSheetId.trim()) { setError('יש להכניס את מזהה הגיליון שלך (או לחבר Google Sheets בהגדרות)'); return }
    setRunning(true)
    setError('')
    setResults(null)
    setSummary(null)

    try {
      const res = await fetch('/api/sheets/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusiness,
          agentSheetId,
          agentSheetName: agentSheetName || undefined,
          ourSheetId: ourSheetId || undefined,
        }),
      })

      let data: any
      try {
        data = await res.json()
      } catch {
        setError(`שגיאת שרת (${res.status}) — נסה שוב`)
        return
      }

      if (!res.ok || data.error) { setError(data.error ?? `שגיאה (${res.status})`); return }

      const totalDiff = data.results
        .filter((r: ReconcileResult) => r.status !== 'match')
        .reduce((s: number, r: ReconcileResult) => s + r.diff, 0)

      setResults(data.results)
      setSummary({ ...data.summary, totalDiff })
    } catch (e: any) {
      setError(`שגיאה: ${e?.message ?? 'לא ידועה'}`)
    } finally {
      setRunning(false)
    }
  }

  function exportCsv() {
    if (!results) return
    const headers = 'מספר הזמנה,עלות סוכן,עלות שלנו,פער,סטטוס'
    const rows = results.map(r =>
      `${r.orderNumber},${r.agentCost.toFixed(2)},${(r.ourCost ?? 0).toFixed(2)},${r.diff.toFixed(2)},${STATUS_LABELS[r.status]?.label ?? r.status}`
    )
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `reconcile-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const filtered = (results ?? [])
    .filter(r => {
      if (filter === 'issues') return r.status !== 'match'
      if (filter === 'match')  return r.status === 'match'
      return true
    })
    .filter(r => !search || r.orderNumber.includes(search))
    .sort((a, b) => {
      const val = sortBy === 'diff'
        ? (sortDir === 'desc' ? b.diff - a.diff : a.diff - b.diff)
        : (sortDir === 'desc'
            ? b.orderNumber.localeCompare(a.orderNumber)
            : a.orderNumber.localeCompare(b.orderNumber))
      return val
    })

  const inputStyle = {
    background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1',
    borderRadius: '10px', padding: '10px 14px', fontSize: '13px',
    outline: 'none', width: '100%', direction: 'ltr' as const,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">בדיקת פערים</h1>
        <p className="text-sm mt-0.5" style={{ color: '#4A5174' }}>
          השוואת עלויות בין הגיליון שלך לגיליון הסוכן
        </p>
      </div>

      {/* Input card */}
      <div className="rounded-2xl border p-6 space-y-5" style={{ background: '#13161F', borderColor: '#1E2130' }}>
        <h2 className="text-white font-semibold">הגדרת מקורות נתונים</h2>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Our sheet */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: '#CBD5E1' }}>
              📊 הגיליון שלך
            </label>
            <input
              value={ourSheetId}
              onChange={e => setOurSheetId(e.target.value.trim())}
              placeholder="מזהה גיליון שלך (ממולא אוטומטית)"
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: '#4A5174' }}>
              עמודה A = מספר הזמנה • עמודה G = עלות שלי
            </p>
          </div>

          {/* Agent sheet */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: '#CBD5E1' }}>
              📦 גיליון הסוכן
            </label>
            <input
              value={agentSheetId}
              onChange={e => setAgentSheetId(e.target.value.trim())}
              placeholder="מזהה גיליון הסוכן"
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: '#4A5174' }}>
              עמודה B = מספר הזמנה • K = מחיר • L = הנחה • M = משלוח
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: '#CBD5E1' }}>
            שם טאב בגיליון הסוכן (אופציונלי)
          </label>
          <input
            value={agentSheetName}
            onChange={e => setAgentSheetName(e.target.value)}
            placeholder="למשל: הזמנות 01/01 - 31/01"
            style={{ ...inputStyle, direction: 'rtl' }}
          />
          <p className="text-xs" style={{ color: '#4A5174' }}>השאר ריק לשימוש בגיליון הראשון</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: '#2D0F0F', color: '#FCA5A5' }}>
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={runReconcile}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
          style={{ background: running ? '#1E2130' : 'linear-gradient(135deg, #4F6EF7, #7C5CFC)' }}
        >
          <span className={running ? 'animate-spin' : ''}>🔍</span>
          {running ? 'מריץ בדיקה...' : 'הרץ בדיקת פערים'}
        </button>
      </div>

      {/* Results */}
      {summary && results && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'סה"כ הזמנות', val: summary.total, color: '#CBD5E1', bg: '#13161F' },
              { label: '✓ תואמות', val: summary.matches, color: '#22C55E', bg: '#0D2818' },
              { label: '⚠️ פערים', val: summary.agentHigher + summary.weHigher, color: '#F59E0B', bg: '#2A1800' },
              { label: '⏳ חסרה עלות', val: summary.missingCost, color: '#6B7280', bg: '#1A1D2A' },
              { label: 'סה"כ פער כספי', val: `₪${summary.totalDiff.toFixed(2)}`, color: '#F97316', bg: '#2A1200', isText: true },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4 text-center border" style={{ background: s.bg, borderColor: '#1E2130' }}>
                <p className="text-2xl font-extrabold" style={{ color: s.color }}>
                  {s.isText ? s.val : s.val}
                </p>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Table controls */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'הכל' },
                { key: 'issues', label: '⚠️ פערים בלבד' },
                { key: 'match', label: '✓ תואמים' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as any)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: filter === f.key ? '#1E2846' : '#13161F',
                    color: filter === f.key ? '#4F6EF7' : '#6B7280',
                    border: `1px solid ${filter === f.key ? '#4F6EF7' : '#1E2130'}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4A5174' }} />
                <input
                  placeholder="חפש מספר הזמנה..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ ...inputStyle, paddingRight: '36px', width: '200px' }}
                />
              </div>
              <button
                onClick={exportCsv}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
                style={{ background: '#13161F', borderColor: '#1E2130', color: '#CBD5E1' }}
              >
                <Download className="w-4 h-4" />
                ייצא CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: '#13161F', borderColor: '#1E2130' }}>
            {/* Table header */}
            <div className="grid grid-cols-5 gap-4 px-5 py-3 text-xs font-semibold uppercase" style={{ background: '#0D0F14', color: '#4A5174', borderBottom: '1px solid #1E2130' }}>
              <button className="flex items-center gap-1 hover:text-white transition-colors" onClick={() => { setSortBy('order'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}>
                מספר הזמנה {sortBy === 'order' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </button>
              <span>עלות סוכן</span>
              <span>עלות שלנו</span>
              <button className="flex items-center gap-1 hover:text-white transition-colors" onClick={() => { setSortBy('diff'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}>
                פער {sortBy === 'diff' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </button>
              <span>סטטוס</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: '#4A5174' }}>
                  אין תוצאות עבור הסינון הנוכחי
                </div>
              ) : (
                filtered.map(r => {
                  const meta = STATUS_LABELS[r.status]
                  const Icon = meta?.icon ?? CheckCircle
                  return (
                    <div
                      key={r.orderNumber}
                      className="grid grid-cols-5 gap-4 px-5 py-4 items-center transition-colors"
                      style={{ background: r.status !== 'match' ? `${meta?.bg}88` : 'transparent', borderBottom: '1px solid #1A1D2A' }}
                    >
                      <span className="font-mono font-semibold text-sm text-white">#{r.orderNumber}</span>

                      <span className="text-sm" style={{ color: '#CBD5E1' }}>
                        ₪{r.agentCost.toFixed(2)}
                      </span>

                      <span className="text-sm" style={{ color: r.ourCost == null ? '#4A5174' : '#CBD5E1' }}>
                        {r.ourCost != null ? `₪${r.ourCost.toFixed(2)}` : '—'}
                      </span>

                      <span className="text-sm font-bold" style={{ color: r.diff > 0 ? '#F59E0B' : '#22C55E' }}>
                        {r.diff > 0 ? `₪${r.diff.toFixed(2)}` : '—'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <div className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1" style={{ background: meta?.bg, color: meta?.color }}>
                          <Icon className="w-3 h-3" />
                          {meta?.label}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 text-xs flex justify-between items-center" style={{ background: '#0D0F14', borderTop: '1px solid #1E2130', color: '#4A5174' }}>
              <span>מציג {filtered.length} מתוך {results.length} הזמנות</span>
              <span>
                סה"כ פער בהזמנות המוצגות: <strong style={{ color: '#F59E0B' }}>
                  ₪{filtered.filter(r => r.diff > 0).reduce((s, r) => s + r.diff, 0).toFixed(2)}
                </strong>
              </span>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!results && !running && (
        <div className="rounded-2xl border p-14 text-center" style={{ background: '#13161F', borderColor: '#1E2130' }}>
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-white font-semibold mb-2">מוכן לבדיקה</h3>
          <p className="text-sm" style={{ color: '#4A5174' }}>
            הכנס את מזהה גיליון הסוכן ולחץ הרץ — הדוח יופיע כאן
          </p>
        </div>
      )}

      {running && (
        <div className="rounded-2xl border p-14 text-center" style={{ background: '#13161F', borderColor: '#1E2130' }}>
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <h3 className="text-white font-semibold mb-2">מריץ בדיקה...</h3>
          <p className="text-sm" style={{ color: '#4A5174' }}>קורא שני גיליונות ומשווה לפי מספר הזמנה</p>
        </div>
      )}
    </div>
  )
}
