'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Download, Search, ChevronDown, ChevronUp, RefreshCw, Clock, FileText, Briefcase } from 'lucide-react'

interface ReconcileResult {
  orderNumber: string
  orderDate?: string
  agentCost: number
  ourCost: number | null
  systemCost: number | null
  diff: number
  sheetReason?: string | null
  status: 'match' | 'agent_higher' | 'we_higher' | 'missing_our_cost' | 'missing_in_agent' | 'content_creator'
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
  match:            { label: 'תואם',                    color: '#22C55E', bg: '#0D2818', icon: CheckCircle },
  agent_higher:     { label: 'סוכן חייב פחות',          color: '#F59E0B', bg: '#2A1800', icon: AlertTriangle },
  we_higher:        { label: 'חישוב שלנו גבוה',         color: '#F97316', bg: '#2A1200', icon: AlertTriangle },
  missing_our_cost: { label: 'חסרה עלות אצלנו',         color: '#6B7280', bg: '#1A1D2A', icon: XCircle },
  missing_in_agent: { label: 'חסר בגיליון סוכן',        color: '#8B5CF6', bg: '#1A1040', icon: XCircle },
  content_creator:  { label: 'יוצר תוכן / צלם',        color: '#06B6D4', bg: '#0C1A2A', icon: CheckCircle },
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
  const [lastRunAt, setLastRunAt]         = useState<Date | null>(null)
  const [settingsChanged, setSettingsChanged] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [exclusions, setExclusions]             = useState<Record<string, string>>({})
  const [togglingExclusion, setTogglingExclusion] = useState<string | null>(null)
  const autoRunRef = useRef(false)

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

  // Load exclusions whenever active business changes
  useEffect(() => {
    if (!activeBusiness) return
    fetch(`/api/reconcile/exclude?businessId=${activeBusiness}`)
      .then(r => r.json())
      .then(d => setExclusions(d.exclusions ?? {}))
      .catch(() => {})
  }, [activeBusiness])

  async function toggleExclusion(orderNumber: string) {
    if (!activeBusiness) return
    setTogglingExclusion(orderNumber)
    const isExcluded = !!exclusions[orderNumber]
    const res = await fetch('/api/reconcile/exclude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness, orderNumber, remove: isExcluded }),
    })
    const data = await res.json()
    setExclusions(data.exclusions ?? {})
    setTogglingExclusion(null)
  }

  // Load saved reconcile report from DB whenever active business changes
  useEffect(() => {
    if (!activeBusiness) return
    autoRunRef.current = false
    fetch(`/api/sheets/reconcile?businessId=${activeBusiness}`)
      .then(r => r.json())
      .then(data => {
        const report = data.reports?.[0]
        if (!report) return

        // Pre-populate form fields from saved report
        setAgentSheetId(report.agentSheetId)
        if (report.agentSheetName) setAgentSheetName(report.agentSheetName)
        setOurSheetId(report.ourSheetId)
        setExchangeRate(report.exchangeRate)

        // Compute summary totals from stored results
        const savedResults: ReconcileResult[] = report.results as ReconcileResult[]
        const totalAgentCost = savedResults.reduce((s, r) => s + (r.agentCost ?? 0), 0)
        const totalOurCost   = savedResults.filter(r => r.ourCost != null).reduce((s, r) => s + (r.ourCost ?? 0), 0)
        const totalDiff      = savedResults.filter(r => r.status !== 'match').reduce((s, r) => s + r.diff, 0)

        setResults(savedResults)
        setSummary({ ...(report.summary as any), totalDiff, totalAgentCost, totalOurCost })
        setDebug(report.debug ?? null)
        setLastRunAt(new Date(report.runAt))

        // Check if business settings changed since this report was created
        const bizUpdatedAt = data.businessUpdatedAt ? new Date(data.businessUpdatedAt) : null
        const reportRunAt  = new Date(report.runAt)
        const stale = bizUpdatedAt ? bizUpdatedAt > reportRunAt : false
        setSettingsChanged(stale)
      })
      .catch(() => {})
  }, [activeBusiness])

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
      setLastRunAt(new Date())
      setSettingsChanged(false)
    } catch (e: any) {
      setError(`שגיאה: ${e?.message ?? 'לא ידועה'}`)
    } finally {
      setRunning(false)
    }
  }

  async function generateAgentReport() {
    if (!results || !activeBusiness) return
    // Exclude content creator and business-use orders from gap report
    const overcharged = results.filter(r =>
      r.status === 'agent_higher' && !exclusions[r.orderNumber]
    )
    if (overcharged.length === 0) { alert('אין הזמנות עם חיוב עודף'); return }

    setGeneratingReport(true)
    try {
      // Fetch detailed analysis from DB for each overcharged order
      const res = await fetch('/api/reconcile/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusiness,
          orderNumbers: overcharged.map(r => r.orderNumber),
        }),
      })
      const data = await res.json()
      const dbOrders: Record<string, any> = data.orders ?? {}

      const totalOvercharge = overcharged.reduce((s, r) => s + r.diff, 0)
      const periodLabel = agentSheetName || 'דוח פערי חיוב'
      const today = new Date().toLocaleDateString('he-IL')

      const rows = overcharged
        .sort((a, b) => b.diff - a.diff)
        .map(r => {
          const db = dbOrders[r.orderNumber]
          const analysis = db?.aiAnalysis as any
          let breakdown = ''

          if (analysis) {
            // Agent report: costs in USD only (agent works in USD)
            const items = analysis.line_items_parsed
              ?.filter((i: any) => !i.isGift)
              .map((i: any) => `&nbsp;&nbsp;&nbsp;• ${i.quantity}× ${i.name}: $${(i.unitCostUsd * i.quantity).toFixed(2)}`)
              .join('<br/>') ?? ''

            const shipping = analysis.my_cost_breakdown?.shipping_cost > 0
              ? `<br/>&nbsp;&nbsp;&nbsp;• משלוח לבית: $${analysis.my_cost_breakdown.shipping_cost?.toFixed(2)}`
              : ''

            const gifts = analysis.my_cost_breakdown?.gift_capsule_cost > 0
              ? `<br/>&nbsp;&nbsp;&nbsp;• קפסולות מתנה/הפתעה: $${analysis.my_cost_breakdown.gift_capsule_cost?.toFixed(2)}`
              : ''

            const discounts = analysis.discounts_applied?.length > 0
              ? `<br/>&nbsp;&nbsp;&nbsp;• הנחות: ${analysis.discounts_applied.map((d: any) => d.name).join(', ')}`
              : ''

            breakdown = `
              <div class="breakdown">
                ${r.sheetReason ? `<div style="margin-bottom:8px;color:#7c3aed"><strong>סטטוס בגיליון:</strong> ${r.sheetReason}</div>` : ''}
                <strong>פירוט חישוב נכון:</strong><br/>
                ${items}${shipping}${gifts}${discounts}
                <br/>&nbsp;&nbsp;&nbsp;<strong>סה"כ נכון: $${((r.ourCost ?? 0) / exchangeRate).toFixed(2)}</strong>
                ${analysis.notes ? `<br/>&nbsp;&nbsp;&nbsp;<em>${analysis.notes}</em>` : ''}
              </div>`
          }

          const dateFmt = r.orderDate ? r.orderDate.split(' ')[0] : '—'
          const cardId  = `order-${r.orderNumber}`
          return `
            <div class="order-card" id="${cardId}">
              <div class="order-header" onclick="toggleBreakdown('${cardId}')" style="cursor:pointer">
                <div>
                  <span class="order-num">הזמנה #${r.orderNumber}</span>
                  <span class="order-date">${dateFmt}</span>
                  ${db?.orderSummary ? `<span class="order-summary">${db.orderSummary}</span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:12px">
                  <div class="diff-badge">+₪${r.diff.toFixed(2)} ביתר</div>
                  <span class="toggle-icon" id="${cardId}-icon">▼ פירוט</span>
                </div>
              </div>
              <div class="costs-row">
                <div class="cost-item wrong">
                  <div class="cost-label">חויבתי על ידי הסוכן</div>
                  <div class="cost-value">₪${r.agentCost.toFixed(2)}</div>
                </div>
                <div class="cost-arrow">→</div>
                <div class="cost-item correct">
                  <div class="cost-label">עלות נכונה</div>
                  <div class="cost-value">₪${r.ourCost?.toFixed(2) ?? '—'}</div>
                </div>
                <div class="cost-item diff">
                  <div class="cost-label">הפרש</div>
                  <div class="cost-value">₪${r.diff.toFixed(2)}</div>
                </div>
              </div>
              <div id="${cardId}-breakdown" style="display:none">
                ${breakdown}
              </div>
            </div>`
        }).join('')

      const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <title>דוח פערי חיוב — ${periodLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; font-size: 14px; }
    .page { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    .report-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 28px; }
    .report-title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .report-meta { color: #64748b; font-size: 13px; }
    .report-meta span { margin-left: 20px; }

    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .summary-card { padding: 16px; border-radius: 10px; border: 1px solid #e2e8f0; text-align: center; }
    .summary-card.red { background: #fef2f2; border-color: #fecaca; }
    .summary-card.orange { background: #fff7ed; border-color: #fed7aa; }
    .summary-card.blue { background: #eff6ff; border-color: #bfdbfe; }
    .summary-num { font-size: 26px; font-weight: 800; margin-bottom: 4px; }
    .summary-card.red .summary-num { color: #dc2626; }
    .summary-card.orange .summary-num { color: #ea580c; }
    .summary-card.blue .summary-num { color: #2563eb; }
    .summary-label { font-size: 12px; color: #64748b; }

    .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }

    .order-card { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .order-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .order-num { font-weight: 700; font-size: 15px; color: #0f172a; margin-left: 10px; }
    .order-date { font-size: 12px; color: #64748b; }
    .order-summary { display: block; font-size: 12px; color: #64748b; margin-top: 3px; }
    .diff-badge { background: #fef2f2; color: #dc2626; font-weight: 700; font-size: 14px; padding: 4px 12px; border-radius: 20px; border: 1px solid #fecaca; white-space: nowrap; }

    .costs-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
    .cost-item { flex: 1; text-align: center; padding: 10px; border-radius: 8px; }
    .cost-item.wrong { background: #fef2f2; }
    .cost-item.correct { background: #f0fdf4; }
    .cost-item.diff { background: #fff7ed; }
    .cost-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .cost-value { font-size: 17px; font-weight: 800; }
    .cost-item.wrong .cost-value { color: #dc2626; }
    .cost-item.correct .cost-value { color: #16a34a; }
    .cost-item.diff .cost-value { color: #ea580c; }
    .cost-arrow { color: #94a3b8; font-size: 18px; }

    .breakdown { padding: 12px 16px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 13px; color: #475569; line-height: 1.9; }
    .breakdown strong { color: #1e293b; }

    .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    .toggle-icon { font-size: 12px; color: #64748b; user-select: none; }
    .order-header:hover .toggle-icon { color: #3b82f6; }

    @media print {
      body { background: white; padding: 0; }
      .page { box-shadow: none; padding: 20px; }
      .order-card { break-inside: avoid; }
      .no-print { display: none; }
      [id$="-breakdown"] { display: block !important; }
      .toggle-icon { display: none; }
    }
  </style>
  <script>
    function toggleBreakdown(id) {
      const el   = document.getElementById(id + '-breakdown')
      const icon = document.getElementById(id + '-icon')
      if (!el) return
      const open = el.style.display === 'none'
      el.style.display   = open ? 'block' : 'none'
      icon.textContent   = open ? '▲ סגור' : '▼ פירוט'
    }
  <\/script>
</head>
<body>
<div class="page">

  <div class="report-header">
    <div class="report-title">דוח פערי חיוב — ${periodLabel}</div>
    <div class="report-meta">
      <span>תאריך הפקה: ${today}</span>
      <span>שיעור המרה: $1 = ₪${exchangeRate}</span>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card red">
      <div class="summary-num">${overcharged.length}</div>
      <div class="summary-label">הזמנות עם חיוב עודף</div>
    </div>
    <div class="summary-card orange">
      <div class="summary-num">₪${totalOvercharge.toFixed(2)}</div>
      <div class="summary-label">סה"כ חיוב עודף</div>
    </div>
    <div class="summary-card blue">
      <div class="summary-num">₪${(totalOvercharge / overcharged.length).toFixed(2)}</div>
      <div class="summary-label">ממוצע פער להזמנה</div>
    </div>
  </div>

  <div class="section-title">פירוט הזמנות — ממויין לפי גודל הפער</div>
  ${rows}

  ${(() => {
    const creators = results.filter(r => r.status === 'content_creator')
    if (!creators.length) return ''
    return `
  <div style="margin-top:32px;padding:20px;background:#f0f9ff;border-radius:10px;border:1px solid #bae6fd">
    <p style="font-weight:700;color:#0369a1;margin-bottom:12px">📸 הזמנות יוצרי תוכן / צלמים (${creators.length} הזמנות — לא נכללות בחישוב הפערים)</p>
    ${creators.map(r => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #e0f2fe">
      <span>#${r.orderNumber} ${r.orderDate ? `— ${r.orderDate.split(' ')[0]}` : ''}</span>
      <span style="color:#0369a1">${r.sheetReason ?? 'יוצר תוכן'}</span>
    </div>`).join('')}
  </div>`
  })()}

  ${(() => {
    const bizUse = results.filter(r => exclusions[r.orderNumber])
    if (!bizUse.length) return ''
    const totalAmt = bizUse.reduce((s, r) => s + r.diff, 0)
    return `
  <div style="margin-top:16px;padding:20px;background:#faf5ff;border-radius:10px;border:1px solid #e9d5ff">
    <p style="font-weight:700;color:#7c3aed;margin-bottom:12px">💼 שימוש עסקי (${bizUse.length} הזמנות — לא נכללות בחישוב הפערים)</p>
    ${bizUse.map(r => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #ede9fe">
      <span>#${r.orderNumber} ${r.orderDate ? `— ${r.orderDate.split(' ')[0]}` : ''}</span>
      <span style="color:#7c3aed">₪${r.diff.toFixed(2)} הפרש (סומן כשימוש עסקי)</span>
    </div>`).join('')}
    <div style="margin-top:8px;font-size:12px;color:#7c3aed;font-weight:600">סה"כ: ₪${totalAmt.toFixed(2)}</div>
  </div>`
  })()}

  <div class="footer">
    דוח זה הופק על ידי מערכת מנהל רווחיות • כל הסכומים בשקלים ישראלים (₪)
  </div>
</div>

<script>
  window.onload = function() { window.print(); }
<\/script>
</body>
</html>`

      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
      }
    } finally {
      setGeneratingReport(false)
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

  const bizExpenses = (results ?? []).filter(r =>
    r.status === 'content_creator' || exclusions[r.orderNumber]
  )

  const filtered = (results ?? [])
    .filter(r => {
      if (filter === 'business') return r.status === 'content_creator' || !!exclusions[r.orderNumber]
      // All other filters: exclude business expenses from main table
      if (r.status === 'content_creator' || exclusions[r.orderNumber]) return false
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

      {/* Settings-changed banner */}
      {settingsChanged && (
        <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: '#2A1800', border: '1px solid #F59E0B44', color: '#FCD34D' }}>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 shrink-0" />
            הגדרות העסק השתנו מאז הבדיקה האחרונה — הדוח יכול להיות לא מעודכן
          </div>
          <button
            onClick={runReconcile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all"
            style={{ background: '#F59E0B', color: '#000' }}
          >
            <RefreshCw className="w-3 h-3" />
            עדכן עכשיו
          </button>
        </div>
      )}

      {/* Last run indicator */}
      {lastRunAt && !settingsChanged && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#4A5174' }}>
          <Clock className="w-3 h-3" />
          הבדיקה האחרונה רצה ב-{lastRunAt.toLocaleDateString('he-IL')} {lastRunAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

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
              <button
                onClick={generateAgentReport}
                disabled={generatingReport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)', color: '#fff' }}
              >
                <FileText className="w-4 h-4" />
                {generatingReport ? 'מכין...' : 'דוח לסוכן'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: '#13161F', borderColor: '#1E2130' }}>
            {/* Table header */}
            <div className="grid grid-cols-7 gap-3 px-5 py-3 text-xs font-semibold uppercase" style={{ background: '#0D0F14', color: '#4A5174', borderBottom: '1px solid #1E2130' }}>
              <button className="flex items-center gap-1 hover:text-white transition-colors" onClick={() => { setSortBy('order'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}>
                מספר הזמנה {sortBy === 'order' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </button>
              <span>תאריך</span>
              <span>עלות סוכן (₪)</span>
              <span>עלות שלי (₪)</span>
              <span style={{ color: '#4F6EF7' }}>עלות מערכת (₪)</span>
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
                      className="grid grid-cols-7 gap-3 px-5 py-4 items-center transition-colors"
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

                      {/* System cost from DB */}
                      <span className="text-sm font-medium" style={{ color: r.systemCost != null ? '#818CF8' : '#374151' }}>
                        {r.systemCost != null ? `₪${r.systemCost.toFixed(2)}` : '—'}
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

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {exclusions[r.orderNumber] ? (
                          <button
                            onClick={() => toggleExclusion(r.orderNumber)}
                            disabled={togglingExclusion === r.orderNumber}
                            className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-all hover:opacity-70"
                            style={{ background: '#1A2A1A', color: '#4ADE80', border: '1px solid #166534' }}
                            title="לחץ להסרת הסימון"
                          >
                            <Briefcase className="w-3 h-3" />
                            שימוש עסקי ✓
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1" style={{ background: meta?.bg, color: meta?.color }}>
                              <Icon className="w-3 h-3" />
                              {meta?.label}
                            </div>
                            {(r.status === 'agent_higher' || r.status === 'we_higher') && (
                              <button
                                onClick={() => toggleExclusion(r.orderNumber)}
                                disabled={togglingExclusion === r.orderNumber}
                                className="px-2 py-1 rounded-full text-xs transition-all hover:opacity-80"
                                style={{ background: '#1A1D2A', color: '#6B7280', border: '1px solid #1E2130' }}
                                title="סמן כשימוש עסקי"
                              >
                                <Briefcase className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
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

      {/* Business Expenses Section */}
      {results && (() => {
        const contentCreators = results.filter(r => r.status === 'content_creator')
        const manuallyMarked  = results.filter(r => r.status !== 'content_creator' && exclusions[r.orderNumber])
        const allBizExpenses  = [...contentCreators, ...manuallyMarked]
        if (allBizExpenses.length === 0) return null

        const totalBizAmount = allBizExpenses.reduce((s, r) => s + (r.ourCost ?? r.agentCost ?? 0), 0)

        return (
          <div className="rounded-2xl border overflow-hidden" style={{ background: '#13161F', borderColor: '#1E2130' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#0D0F14', borderBottom: '1px solid #1E2130' }}>
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-5 h-5" style={{ color: '#A78BFA' }} />
                <div>
                  <h3 className="text-white font-semibold text-sm">הוצאות עסקיות</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#4A5174' }}>
                    לא נכנסות לחישוב הפערים — מוצגות בנפרד בדוח לסוכן
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ color: '#A78BFA' }}>₪{totalBizAmount.toFixed(2)}</p>
                <p className="text-xs" style={{ color: '#4A5174' }}>{allBizExpenses.length} הזמנות</p>
              </div>
            </div>

            {/* Sub-sections */}
            {contentCreators.length > 0 && (
              <div>
                <div className="px-5 py-2 text-xs font-semibold uppercase flex items-center gap-2"
                  style={{ background: '#0C1A2A', color: '#06B6D4', borderBottom: '1px solid #1E2130' }}>
                  📸 יוצרי תוכן / צלמים ({contentCreators.length})
                </div>
                {contentCreators.map(r => (
                  <div key={r.orderNumber} className="flex items-center justify-between px-5 py-3 border-b text-sm"
                    style={{ borderColor: '#1A1D2A' }}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-white">#{r.orderNumber}</span>
                      <span className="text-xs" style={{ color: '#6B7280' }}>{r.orderDate?.split(' ')[0] ?? '—'}</span>
                      {r.sheetReason && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#0C1A2A', color: '#06B6D4' }}>
                          {r.sheetReason}
                        </span>
                      )}
                    </div>
                    <span className="text-sm" style={{ color: '#CBD5E1' }}>
                      ₪{(r.ourCost ?? r.agentCost ?? 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {manuallyMarked.length > 0 && (
              <div>
                <div className="px-5 py-2 text-xs font-semibold uppercase flex items-center gap-2"
                  style={{ background: '#1A1040', color: '#A78BFA', borderBottom: '1px solid #1E2130' }}>
                  💼 שימוש עסקי ידני ({manuallyMarked.length})
                </div>
                {manuallyMarked.map(r => {
                  const meta = STATUS_LABELS[r.status]
                  return (
                    <div key={r.orderNumber} className="flex items-center justify-between px-5 py-3 border-b text-sm"
                      style={{ borderColor: '#1A1D2A' }}>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-white">#{r.orderNumber}</span>
                        <span className="text-xs" style={{ color: '#6B7280' }}>{r.orderDate?.split(' ')[0] ?? '—'}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: meta?.bg, color: meta?.color }}>
                          {meta?.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm" style={{ color: '#CBD5E1' }}>
                          ₪{(r.ourCost ?? r.agentCost ?? 0).toFixed(2)}
                        </span>
                        <button onClick={() => toggleExclusion(r.orderNumber)}
                          disabled={togglingExclusion === r.orderNumber}
                          className="text-xs px-2 py-1 rounded-lg transition-all hover:opacity-70"
                          style={{ background: '#1A1D2A', color: '#6B7280', border: '1px solid #1E2130' }}>
                          הסר
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

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
