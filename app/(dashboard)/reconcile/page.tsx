'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Download, Search, ChevronDown, ChevronUp } from 'lucide-react'

interface ReconcileResult {
  orderNumber: string
  orderDate?: string
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
  const [agentTabs, setAgentTabs]         = useState<string[]>([])
  const [loadingTabs, setLoadingTabs]     = useState(false)
  const [exchangeRate, setExchangeRate]   = useState(3.4)
  const [running, setRunning]             = useState(false)
  const [results, setResults]             = useState<ReconcileResult[] | null>(null)
  const [summary, setSummary]             = useState<Summary | null>(null)
  const [debug, setDebug]                 = useState<any | null>(null)
  const [error, setError]                 = useState('')
  const [filter, setFilter]               = useState<'all' | 'issues' | 'match' | 'missing'>('all')
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

  async function loadAgentTabs(url: string) {
    const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? url.trim()
    if (!id || !activeBusiness) return
    setLoadingTabs(true)
    try {
      const res = await fetch(`/api/sheets/tabs?businessId=${activeBusiness}&sheetId=${id}`)
      const data = await res.json()
      setAgentTabs(data.tabs ?? [])
      if (data.tabs?.length > 0) setAgentSheetName(data.tabs[0])
    } finally { setLoadingTabs(false) }
  }

  function extractSheetId(input: string): string {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : input.trim()
  }

  async function runReconcile() {
    if (!activeBusiness) { setError('בחר עסק מהתפריט הצדדי'); return }
    if (!agentSheetId.trim()) { setError('יש להכניס את מזהה גיליון הסוכן'); return }
    if (!ourSheetId.trim()) { setError('יש להכניס את מזהה הגיליון שלך'); return }
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
          agentSheetId: extractSheetId(agentSheetId),
          agentSheetName: agentSheetName || undefined,
          ourSheetId: extractSheetId(ourSheetId),
          exchangeRate,
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

      const totalAgentCost = data.results
        .reduce((s: number, r: ReconcileResult) => s + (r.agentCost ?? 0), 0)

      const totalOurCost = data.results
        .filter((r: ReconcileResult) => r.ourCost != null)
        .reduce((s: number, r: ReconcileResult) => s + (r.ourCost ?? 0), 0)

      setResults(data.results)
      setSummary({ ...data.summary, totalDiff, totalAgentCost, totalOurCost })
      setDebug(data.debug ?? null)
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
      if (filter === 'issues')  return r.status === 'agent_higher' || r.status === 'we_higher'
      if (filter === 'match')   return r.status === 'match'
      if (filter === 'missing') return r.status === 'missing_our_cost'
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
              עמודה A = מספר הזמנה • עמודה G = עלות שלי (₪)
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: '#CBD5E1' }}>
              💱 שער המרה ($ → ₪)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={e => setExchangeRate(parseFloat(e.target.value) || 3.4)}
                style={{ ...inputStyle, paddingLeft: '48px' }}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: '#4A5174' }}>$/₪</span>
            </div>
            <p className="text-xs" style={{ color: '#4A5174' }}>
              עלות הסוכן ($) × שער = עלות בשקל להשוואה
            </p>
          </div>
          <div />

          {/* Agent sheet */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: '#CBD5E1' }}>
              📦 גיליון הסוכן
            </label>
            <input
              value={agentSheetId}
              onChange={e => setAgentSheetId(e.target.value)}
              onBlur={e => loadAgentTabs(e.target.value)}
              placeholder="URL מלא או מזהה גיליון הסוכן"
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: '#4A5174' }}>
              עמודה B = מספר הזמנה • K = מחיר • L = הנחה • M = משלוח
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: '#CBD5E1' }}>
            בחר טאב בגיליון הסוכן
          </label>
          {loadingTabs ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#4A5174' }}>
              <span className="animate-spin">⏳</span> טוען טאבים...
            </div>
          ) : agentTabs.length > 0 ? (
            <select
              value={agentSheetName}
              onChange={e => setAgentSheetName(e.target.value)}
              style={{ ...inputStyle, direction: 'rtl' }}
            >
              {agentTabs.map(tab => (
                <option key={tab} value={tab}>{tab}</option>
              ))}
            </select>
          ) : (
            <input
              value={agentSheetName}
              onChange={e => setAgentSheetName(e.target.value)}
              placeholder="הכנס URL הגיליון למעלה לבחירת טאב אוטומטית"
              style={{ ...inputStyle, direction: 'rtl' }}
            />
          )}
          <p className="text-xs" style={{ color: '#4A5174' }}>
            {agentTabs.length > 0 ? `${agentTabs.length} טאבים נמצאו` : 'השאר ריק לשימוש בגיליון הראשון'}
          </p>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'סה"כ הזמנות', val: String(summary.total), color: '#CBD5E1', bg: '#13161F' },
              { label: '✓ תואמות', val: String(summary.matches), color: '#22C55E', bg: '#0D2818' },
              { label: '⚠️ פערים', val: String(summary.agentHigher + summary.weHigher), color: '#F59E0B', bg: '#2A1800' },
              { label: 'עלות סוכן סה"כ', val: `₪${(summary as any).totalAgentCost?.toFixed(2) ?? '0'}`, color: '#60A5FA', bg: '#0D1A2A' },
              { label: 'עלות שלי סה"כ', val: `₪${(summary as any).totalOurCost?.toFixed(2) ?? '0'}`, color: '#A78BFA', bg: '#150D2A' },
              (() => {
                const diff = ((summary as any).totalAgentCost ?? 0) - ((summary as any).totalOurCost ?? 0)
                // agentCost > ourCost = agent charged more = BAD = red
                // agentCost < ourCost = agent charged less = GOOD = green
                const isGood = diff <= 0
                return { label: `הפרש כולל ${isGood ? '✓ לטובתי' : '✗ נגדי'}`, val: `₪${Math.abs(diff).toFixed(2)}`, color: isGood ? '#22C55E' : '#EF4444', bg: isGood ? '#0D2818' : '#2D0F0F' }
              })(),
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4 text-center border" style={{ background: s.bg, borderColor: '#1E2130' }}>
                <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.val}</p>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Debug panel */}
          {debug && summary && summary.matches === 0 && (
            <div className="rounded-xl border p-4 text-xs" style={{ background: '#1A1400', borderColor: '#3A2800' }}>
              <p className="text-yellow-400 font-semibold text-sm mb-3">⚠️ אין התאמות — טווחי מספרי הזמנה</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 font-medium" style={{ color: '#8B8FA8' }}>סוכן ({debug.agentTotal} הזמנות)</p>
                  <p style={{ color: '#6B7280' }}>ראשונים: {debug.agentFirst5?.join(', ')}</p>
                  <p style={{ color: '#6B7280' }}>אחרונים: {debug.agentLast5?.join(', ')}</p>
                </div>
                <div>
                  <p className="mb-1 font-medium" style={{ color: '#8B8FA8' }}>שלך ({debug.ourTotal} הזמנות)</p>
                  <p style={{ color: '#6B7280' }}>ראשונים: {debug.ourFirst5?.join(', ')}</p>
                  <p style={{ color: '#6B7280' }}>אחרונים: {debug.ourLast5?.join(', ')}</p>
                </div>
              </div>
              <p className="mt-2" style={{ color: '#8B8FA8' }}>
                תאריכים: <span className="text-yellow-400">{debug.dateRangeParsed}</span>
              </p>
              {debug.detectedCols && (
                <p className="mt-1" style={{ color: '#8B8FA8' }}>
                  עמודות שזוהו: <span className="text-yellow-400">{debug.detectedCols}</span>
                </p>
              )}
              {debug.directMatchTest && (
                <div className="mt-2">
                  <p style={{ color: '#8B8FA8' }}>בדיקת התאמה ישירה:</p>
                  {debug.directMatchTest.map((t: any) => (
                    <p key={t.key} style={{ color: t.inOur ? '#22C55E' : '#EF4444' }}>
                      #{t.key}: {t.inOur ? '✓ נמצא בגיליון שלך' : '✗ לא נמצא בגיליון שלך'}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Table controls */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'הכל' },
                { key: 'issues', label: '⚠️ פערים' },
                { key: 'match', label: '✓ תואמים' },
                { key: 'missing', label: '⏳ חסרה עלות' },
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
            <div className="grid grid-cols-6 gap-4 px-5 py-3 text-xs font-semibold uppercase" style={{ background: '#0D0F14', color: '#4A5174', borderBottom: '1px solid #1E2130' }}>
              <button className="flex items-center gap-1 hover:text-white transition-colors" onClick={() => { setSortBy('order'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}>
                מספר הזמנה {sortBy === 'order' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </button>
              <span>תאריך</span>
              <span>עלות סוכן (₪)</span>
              <span>עלות שלי (₪)</span>
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
                      className="grid grid-cols-6 gap-4 px-5 py-4 items-center transition-colors"
                      style={{ background: r.status !== 'match' ? `${meta?.bg}88` : 'transparent', borderBottom: '1px solid #1A1D2A' }}
                    >
                      <span className="font-mono font-semibold text-sm text-white">#{r.orderNumber}</span>

                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        {r.orderDate ? r.orderDate.split(' ')[0] : '—'}
                      </span>

                      <span className="text-sm" style={{ color: '#CBD5E1' }}>
                        ₪{r.agentCost.toFixed(2)}
                      </span>

                      <span className="text-sm" style={{ color: r.ourCost == null ? '#4A5174' : '#CBD5E1' }}>
                        {r.ourCost != null ? `₪${r.ourCost.toFixed(2)}` : '—'}
                      </span>

                      <span className="text-sm font-bold" style={{
                        color: r.diff <= 0.5 ? '#22C55E'
                          : r.status === 'agent_higher' ? '#EF4444'
                          : '#22C55E'
                      }}>
                        {r.diff > 0.5
                          ? `${r.status === 'agent_higher' ? '▲' : '▼'} ₪${r.diff.toFixed(2)}`
                          : r.diff > 0 ? `₪${r.diff.toFixed(2)}` : '—'}
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
