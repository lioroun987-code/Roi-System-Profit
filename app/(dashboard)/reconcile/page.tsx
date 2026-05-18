'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Download, Search, ChevronDown, ChevronUp, RefreshCw, Clock, FileText, Briefcase } from 'lucide-react'

interface ReconcileResult {
  orderNumber: string
  orderDate?: string
  agentCost: number
  warIls?: number
  ourCost: number | null
  systemCost: number | null
  diff: number
  sheetReason?: string | null
  status: 'match' | 'agent_higher' | 'we_higher' | 'missing_our_cost' | 'missing_in_agent' | 'content_creator' | 'personal_diff'
}

interface ColMapping {
  order: string
  price: string
  discount: string
  homeDelivery: string
  warSurcharge: string
  ourOrderCol: string   // column in OUR sheet with order number
  ourCostCol: string    // column in OUR sheet with our cost
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
  personal_diff:    { label: 'פער אישי לבדיקה',         color: '#E879F9', bg: '#1A0D2A', icon: AlertTriangle },
}

export default function ReconcilePage() {
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)
  const [ourSheetId, setOurSheetId]       = useState('')
  const [agentSheetId, setAgentSheetId]   = useState('')
  const [agentSheetName, setAgentSheetName] = useState('')
  const [agentTabs, setAgentTabs]         = useState<string[]>([])
  const [loadingTabs, setLoadingTabs]     = useState(false)
  const [exchangeRate, setExchangeRate]   = useState(3.4)
  const [colMapping, setColMapping]       = useState<ColMapping>(() => {
    try { return JSON.parse(localStorage.getItem('reconcile_colMapping') ?? '{}') } catch { return {} }
    return { order: 'B', price: 'K', discount: 'M', homeDelivery: 'N', warSurcharge: '', ourOrderCol: 'A', ourCostCol: '' }
  })
  const [showColConfig, setShowColConfig] = useState(false)

  const DEFAULT_COL: ColMapping = { order: 'B', price: 'K', discount: 'M', homeDelivery: 'N', warSurcharge: '', ourOrderCol: 'A', ourCostCol: '' }
  const effectiveCol = { ...DEFAULT_COL, ...colMapping }

  function updateColMapping(key: keyof ColMapping, val: string) {
    const updated = { ...effectiveCol, [key]: val }
    setColMapping(updated)
    localStorage.setItem('reconcile_colMapping', JSON.stringify(updated))
  }
  const [running, setRunning]             = useState(false)
  const [results, setResults]             = useState<ReconcileResult[] | null>(null)
  const [summary, setSummary]             = useState<Summary | null>(null)
  const [debug, setDebug]                 = useState<any | null>(null)
  const [error, setError]                 = useState('')
  const [filter, setFilter]               = useState<'all' | 'issues' | 'match' | 'missing' | 'business' | 'personal'>('all')
  const [search, setSearch]               = useState('')
  const [sortBy, setSortBy]               = useState<'diff' | 'order'>('diff')
  const [sortDir, setSortDir]             = useState<'desc' | 'asc'>('desc')
  const [lastRunAt, setLastRunAt]         = useState<Date | null>(null)
  const [settingsChanged, setSettingsChanged] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [exclusions, setExclusions]             = useState<Record<string, string>>({})
  const [togglingExclusion, setTogglingExclusion] = useState<string | null>(null)
  const [expenseTypeModal, setExpenseTypeModal] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder]       = useState<string | null>(null)
  const [expandedData, setExpandedData]         = useState<Record<string, any>>({})
  const [loadingExpand, setLoadingExpand]       = useState<string | null>(null)
  const autoRunRef = useRef(false)

  async function toggleOrderExpand(orderNumber: string) {
    if (expandedOrder === orderNumber) { setExpandedOrder(null); return }
    setExpandedOrder(orderNumber)
    if (expandedData[orderNumber]) return
    setLoadingExpand(orderNumber)
    try {
      const res = await fetch(`/api/orders/by-number?businessId=${activeBusiness}&orderNumber=${orderNumber}`)
      if (res.ok) {
        const data = await res.json()
        setExpandedData(prev => ({ ...prev, [orderNumber]: data }))
      }
    } finally { setLoadingExpand(null) }
  }

  const EXPENSE_TYPES = [
    { id: 'content_creator', label: 'יוצר תוכן' },
    { id: 'photography',     label: 'צילום מוצרים' },
    { id: 'gift',            label: 'מתנה / שי' },
    { id: 'employee',        label: 'עובד / צוות' },
    { id: 'other',           label: 'אחר' },
  ]

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

  async function toggleExclusion(orderNumber: string, reason?: string) {
    if (!activeBusiness) return
    setTogglingExclusion(orderNumber)
    const isExcluded = !!exclusions[orderNumber] && !reason
    const res = await fetch('/api/reconcile/exclude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness, orderNumber, remove: isExcluded, reason }),
    })
    const data = await res.json()
    setExclusions(data.exclusions ?? {})
    setTogglingExclusion(null)
    setExpenseTypeModal(null)
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
          colMapping,
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

          if (analysis?.line_items_parsed?.length > 0) {
            const items = analysis.line_items_parsed
              .filter((i: any) => !i.isGift)
              .map((i: any) => `<tr>
                <td style="padding:4px 8px">${i.quantity}× ${i.name}</td>
                <td style="padding:4px 8px;text-align:left;font-weight:600">$${(i.unitCostUsd * i.quantity).toFixed(2)}</td>
              </tr>`).join('')

            const shipping = analysis.my_cost_breakdown?.shipping_cost > 0
              ? `<tr><td style="padding:4px 8px">משלוח לבית</td><td style="padding:4px 8px;text-align:left">$${analysis.my_cost_breakdown.shipping_cost?.toFixed(2)}</td></tr>`
              : ''

            const discountNote = analysis.notes
              ? `<tr><td colspan="2" style="padding:4px 8px;color:#64748b;font-style:italic">${analysis.notes}</td></tr>`
              : ''

            breakdown = `
              <div class="breakdown">
                <p style="font-weight:700;margin-bottom:8px">פירוט החישוב הנכון:</p>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                  ${items}${shipping}${discountNote}
                  <tr style="border-top:1px solid #cbd5e1">
                    <td style="padding:6px 8px;font-weight:700">סה"כ נכון</td>
                    <td style="padding:6px 8px;text-align:left;font-weight:700;color:#dc2626">$${((r.ourCost ?? 0) / exchangeRate).toFixed(2)}</td>
                  </tr>
                </table>
              </div>`
          } else {
            breakdown = `<div class="breakdown" style="color:#94a3b8">פירוט לא זמין — ההזמנה לא נותחה במערכת</div>`
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
                  <div class="diff-badge">+$${(r.diff / exchangeRate).toFixed(2)} ביתר</div>
                  <span class="toggle-icon" id="${cardId}-icon">▲ סגור</span>
                </div>
              </div>
              <div class="costs-row">
                <div class="cost-item wrong">
                  <div class="cost-label">חויבתי על ידי הסוכן</div>
                  <div class="cost-value">$${(r.agentCost / exchangeRate).toFixed(2)}</div>
                  <div style="font-size:11px;color:#94a3b8">₪${r.agentCost.toFixed(2)}</div>
                </div>
                <div class="cost-arrow">→</div>
                <div class="cost-item correct">
                  <div class="cost-label">עלות נכונה</div>
                  <div class="cost-value">$${((r.ourCost ?? 0) / exchangeRate).toFixed(2)}</div>
                  <div style="font-size:11px;color:#94a3b8">₪${r.ourCost?.toFixed(2) ?? '—'}</div>
                </div>
                <div class="cost-item diff">
                  <div class="cost-label">הפרש</div>
                  <div class="cost-value">$${(r.diff / exchangeRate).toFixed(2)}</div>
                  <div style="font-size:11px;color:#94a3b8">₪${r.diff.toFixed(2)}</div>
                </div>
              </div>
              <div id="${cardId}-breakdown" style="display:block">
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
      <div class="summary-num">$${(totalOvercharge / exchangeRate).toFixed(2)}</div>
      <div class="summary-label">סה"כ חיוב עודף</div>
    </div>
    <div class="summary-card blue">
      <div class="summary-num">$${(totalOvercharge / exchangeRate / overcharged.length).toFixed(2)}</div>
      <div class="summary-label">ממוצע פער להזמנה</div>
    </div>
  </div>

  <div class="section-title">פירוט הזמנות — ממויין לפי גודל הפער</div>
  ${rows}

  <div class="footer">
    דוח זה הופק על ידי מערכת מנהל רווחיות • כל הסכומים בשקלים ישראלים (₪)
  </div>

  <div class="no-print" style="text-align:center;margin-top:24px">
    <button onclick="window.print()" style="background:#1e3a5f;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer">
      🖨️ הדפס / שמור PDF
    </button>
  </div>
</div>
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
      if (filter === 'issues')   return r.status === 'agent_higher' || r.status === 'we_higher'
      if (filter === 'personal') return r.status === 'personal_diff'
      if (filter === 'match')    return r.status === 'match'
      if (filter === 'missing')  return r.status === 'missing_our_cost'
      return true
    })
    .filter(r => !search || r.orderNumber.includes(search))
    .sort((a, b) => {
      if (sortBy === 'diff') {
        // signed diff: positive = agent overcharged, negative = we overcharged
        const signedA = a.agentCost - (a.ourCost ?? a.agentCost)
        const signedB = b.agentCost - (b.ourCost ?? b.agentCost)
        return sortDir === 'desc' ? signedB - signedA : signedA - signedB
      }
      return sortDir === 'desc'
        ? b.orderNumber.localeCompare(a.orderNumber)
        : a.orderNumber.localeCompare(b.orderNumber)
    })

  const inputStyle = {
    background: '#0D0F14', border: '1px solid #1E2130', color: '#CBD5E1',
    borderRadius: '10px', padding: '10px 14px', fontSize: '13px',
    outline: 'none', width: '100%', direction: 'ltr' as const,
  }

  // Fix summary cards: exclude business expenses from gap totals
  const nonBizResults = (results ?? []).filter(r =>
    r.status !== 'content_creator' && !exclusions[r.orderNumber]
  )
  const realAgentTotal = nonBizResults.reduce((s, r) => s + r.agentCost, 0)
  const realOurTotal   = nonBizResults.filter(r => r.ourCost != null).reduce((s, r) => s + (r.ourCost ?? 0), 0)
  const realDiff       = realAgentTotal - realOurTotal

  // Parse stored exclusion reason
  function getExclusionReason(orderNumber: string): string {
    const raw = exclusions[orderNumber]
    if (!raw) return ''
    try { return JSON.parse(raw).reason ?? raw } catch { return raw }
  }
  function getExclusionLabel(orderNumber: string): string {
    const reason = getExclusionReason(orderNumber)
    return EXPENSE_TYPES.find(t => t.id === reason)?.label ?? reason ?? 'הוצאה עסקית'
  }

  return (
    <div className="p-6 space-y-6">

      {/* Expense type modal */}
      {expenseTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-80 space-y-4" style={{ background: '#0D0F14', border: '1px solid #1E2130' }}>
            <h3 className="text-white font-bold">סוג הוצאה עסקית</h3>
            <p className="text-sm" style={{ color: '#6B7280' }}>הזמנה #{expenseTypeModal}</p>
            <div className="space-y-2">
              {EXPENSE_TYPES.map(t => (
                <button key={t.id}
                  onClick={() => toggleExclusion(expenseTypeModal!, t.id)}
                  className="w-full text-right px-4 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: '#13161F', color: '#CBD5E1', border: '1px solid #1E2130' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={() => setExpenseTypeModal(null)}
              className="w-full py-2 rounded-xl text-sm" style={{ color: '#4A5174' }}>
              ביטול
            </button>
          </div>
        </div>
      )}

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
            {/* Column mapping toggle */}
            <button
              onClick={() => setShowColConfig(v => !v)}
              className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
              style={{ color: '#4F6EF7' }}
            >
              ⚙️ {showColConfig ? 'סגור' : 'שנה מיפוי עמודות'}
            </button>
            {showColConfig && (
              <div className="rounded-xl p-4 space-y-4" style={{ background: '#0D0F14', border: '1px solid #1E2130' }}>
                {/* Agent sheet columns */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#60A5FA' }}>גיליון הסוכן — עמודות</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'order',        label: 'מספר הזמנה',     placeholder: 'B' },
                      { key: 'price',        label: 'מחיר ($)',        placeholder: 'K' },
                      { key: 'discount',     label: 'הנחה ($)',         placeholder: 'M' },
                      { key: 'homeDelivery', label: 'משלוח לבית ($)',  placeholder: 'N' },
                      { key: 'warSurcharge', label: 'תוספת מלחמה ($)', placeholder: 'ריק = לא קיים' },
                    ] as const).map(f => (
                      <div key={f.key} className="space-y-1">
                        <label className="text-xs" style={{ color: '#6B7280' }}>{f.label}</label>
                        <input value={colMapping[f.key]}
                          onChange={e => setColMapping(prev => ({ ...prev, [f.key]: e.target.value.toUpperCase().slice(0, 2) }))}
                          placeholder={f.placeholder} maxLength={2}
                          style={{ ...inputStyle, width: '70px', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace' }}
                          dir="ltr" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Our sheet columns */}
                <div style={{ borderTop: '1px solid #1E2130', paddingTop: '12px' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#A78BFA' }}>גיליון שלי — עמודות</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'ourOrderCol', label: 'מספר הזמנה', placeholder: 'A' },
                      { key: 'ourCostCol',  label: 'עלות שלי (₪) — ריק = מה-DB', placeholder: 'ריק' },
                    ] as const).map(f => (
                      <div key={f.key} className="space-y-1">
                        <label className="text-xs" style={{ color: '#6B7280' }}>{f.label}</label>
                        <input value={colMapping[f.key]}
                          onChange={e => setColMapping(prev => ({ ...prev, [f.key]: e.target.value.toUpperCase().slice(0, 2) }))}
                          placeholder={f.placeholder} maxLength={2}
                          style={{ ...inputStyle, width: '70px', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace' }}
                          dir="ltr" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: '#4A5174' }}>
                    אם תמלא עמודת עלות — "עלות שלי" תציג בדיוק מה שכתוב בגיליון שלך
                  </p>
                </div>
              </div>
            )}
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
          {(() => {
            const totalWar = colMapping.warSurcharge
              ? results.filter(r => !exclusions[r.orderNumber]).reduce((s, r) => s + (r.warIls ?? 0), 0)
              : 0
            const cards = [
              { label: 'סה"כ הזמנות', val: String(summary.total), color: '#CBD5E1', bg: '#13161F' },
              { label: '✓ תואמות', val: String(summary.matches), color: '#22C55E', bg: '#0D2818' },
              { label: '⚠️ פערים', val: String(summary.agentHigher + summary.weHigher), color: '#F59E0B', bg: '#2A1800' },
              { label: 'עלות סוכן (ללא עסקי)', val: `₪${realAgentTotal.toFixed(2)}`, color: '#60A5FA', bg: '#0D1A2A' },
              { label: 'עלות שלי (ללא עסקי)', val: `₪${realOurTotal.toFixed(2)}`, color: '#A78BFA', bg: '#150D2A' },
              (() => { const isGood = realDiff <= 0; return { label: `הפרש ${isGood ? '✓ לטובתי' : '✗ נגדי'}`, val: `₪${Math.abs(realDiff).toFixed(2)}`, color: isGood ? '#22C55E' : '#EF4444', bg: isGood ? '#0D2818' : '#2D0F0F' } })(),
              ...(colMapping.warSurcharge ? [{ label: '⚔️ תוספת מלחמה סה"כ', val: `₪${totalWar.toFixed(2)}`, color: '#F59E0B', bg: '#2A1800' }] : []),
            ]
            return (
              <div className={`grid grid-cols-2 md:grid-cols-3 ${colMapping.warSurcharge ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-4`}>
                {cards.map(s => (
                  <div key={s.label} className="rounded-2xl p-4 text-center border" style={{ background: s.bg, borderColor: '#1E2130' }}>
                    <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )
          })()}

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
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all',      label: 'הכל' },
                { key: 'issues',   label: '⚠️ פערים מול סוכן' },
                { key: 'personal', label: `🔍 פערים אישיים${(results ?? []).filter(r => r.status === 'personal_diff').length > 0 ? ` (${(results ?? []).filter(r => r.status === 'personal_diff').length})` : ''}` },
                { key: 'match',    label: '✓ תואמים' },
                { key: 'missing',  label: '⏳ חסרה עלות' },
                { key: 'business', label: `💼 הוצאות עסקיות${bizExpenses.length > 0 ? ` (${bizExpenses.length})` : ''}` },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as any)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: filter === f.key
                      ? f.key === 'business' ? '#1A1040' : '#1E2846'
                      : '#13161F',
                    color: filter === f.key
                      ? f.key === 'business' ? '#A78BFA' : '#4F6EF7'
                      : '#6B7280',
                    border: `1px solid ${filter === f.key
                      ? f.key === 'business' ? '#A78BFA' : '#4F6EF7'
                      : '#1E2130'}`,
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
            <div className={`grid gap-3 px-5 py-3 text-xs font-semibold uppercase ${colMapping.warSurcharge ? 'grid-cols-8' : 'grid-cols-7'}`} style={{ background: '#0D0F14', color: '#4A5174', borderBottom: '1px solid #1E2130' }}>
              <button className="flex items-center gap-1 hover:text-white transition-colors" onClick={() => { setSortBy('order'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}>
                מספר הזמנה {sortBy === 'order' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </button>
              <span>תאריך</span>
              <span>עלות סוכן (₪)</span>
              {colMapping.warSurcharge && <span style={{ color: '#F59E0B' }}>תוספת מלחמה (₪)</span>}
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
                  const meta     = STATUS_LABELS[r.status]
                  const Icon     = meta?.icon ?? CheckCircle
                  const isOpen   = expandedOrder === r.orderNumber
                  const orderData = expandedData[r.orderNumber]
                  const analysis  = orderData?.aiAnalysis
                  const rate      = analysis?.exchange_rate_used ?? 3.7

                  return (
                    <div key={r.orderNumber} className="border-b" style={{ borderColor: '#1A1D2A' }}>
                      {/* Main row */}
                      <div
                        className={`grid ${colMapping.warSurcharge ? 'grid-cols-8' : 'grid-cols-7'} gap-3 px-5 py-4 items-center cursor-pointer transition-colors hover:bg-white/5`}
                        style={{ background: isOpen ? '#0D0F14' : r.status !== 'match' ? `${meta?.bg}88` : 'transparent' }}
                        onClick={() => toggleOrderExpand(r.orderNumber)}
                      >
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" style={{ color: '#4A5174', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                          <span className="font-mono font-semibold text-sm text-white">#{r.orderNumber}</span>
                        </div>

                        <span className="text-xs" style={{ color: '#6B7280' }}>
                          {r.orderDate ? r.orderDate.split(' ')[0] : '—'}
                        </span>

                        <span className="text-sm" style={{ color: '#CBD5E1' }}>₪{r.agentCost.toFixed(2)}</span>

                        {colMapping.warSurcharge && (
                          <span className="text-sm font-medium" style={{ color: (r.warIls ?? 0) > 0 ? '#F59E0B' : '#374151' }}>
                            {(r.warIls ?? 0) > 0 ? `₪${r.warIls!.toFixed(2)}` : '—'}
                          </span>
                        )}

                        <span className="text-sm" style={{ color: r.ourCost == null ? '#4A5174' : '#CBD5E1' }}>
                          {r.ourCost != null ? `₪${r.ourCost.toFixed(2)}` : '—'}
                        </span>

                        <div>
                          {r.systemCost != null ? (
                            <span className="text-sm font-semibold" style={{ color: '#818CF8' }}>₪{r.systemCost.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#13161F', color: '#374151' }}>לא נותח</span>
                          )}
                        </div>

                        {(() => {
                          const signed = r.agentCost - (r.ourCost ?? r.agentCost)
                          const isOver  = signed > 0.5   // agent overcharged us
                          const isUnder = signed < -0.5  // we overcharged agent
                          return (
                            <span className="text-sm font-bold" style={{ color: Math.abs(signed) <= 0.5 ? '#22C55E' : isOver ? '#EF4444' : '#22C55E' }}>
                              {isOver  ? `▲ +₪${signed.toFixed(2)}` :
                               isUnder ? `▼ ₪${signed.toFixed(2)}` :
                               r.diff > 0 ? `₪${r.diff.toFixed(2)}` : '—'}
                            </span>
                          )
                        })()}

                        <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                          {exclusions[r.orderNumber] ? (
                            <div className="flex items-center gap-1.5">
                              <div className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1" style={{ background: '#1A1040', color: '#A78BFA', border: '1px solid #6D28D9' }}>
                                <Briefcase className="w-3 h-3" />{getExclusionLabel(r.orderNumber)} ✓
                              </div>
                              <button onClick={() => toggleExclusion(r.orderNumber)} className="text-xs hover:underline" style={{ color: '#374151' }}>הסר</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1" style={{ background: meta?.bg, color: meta?.color }}>
                                <Icon className="w-3 h-3" />{meta?.label}
                              </div>
                              <button onClick={() => setExpenseTypeModal(r.orderNumber)} disabled={togglingExclusion === r.orderNumber}
                                className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-all hover:opacity-80"
                                style={{ background: '#1A1040', color: '#A78BFA', border: '1px solid #4C1D95' }}>
                                <Briefcase className="w-3 h-3" />הוצאה עסקית
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded breakdown */}
                      {isOpen && (
                        <div className="px-5 pb-4" style={{ background: '#0D0F14', borderTop: '1px solid #1E2130' }}>
                          {loadingExpand === r.orderNumber ? (
                            <div className="py-4 flex items-center gap-2 text-sm" style={{ color: '#4A5174' }}>
                              <RefreshCw className="w-4 h-4 animate-spin" />טוען פירוט...
                            </div>
                          ) : analysis ? (
                            <div className="pt-4 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A5174' }}>פירוט עלויות המערכת</p>
                              {/* Line items */}
                              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E2130' }}>
                                {analysis.line_items_parsed?.map((item: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: '#1E2130' }}>
                                    <div>
                                      <p className="text-sm text-white">{item.name} × {item.quantity}</p>
                                      <p className="text-xs" style={{ color: '#4A5174' }}>
                                        {item.isGift ? 'מתנה' : `מחיר ללקוח: ₪${item.unitPriceIls?.toFixed(2)}`}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium" style={{ color: item.totalCostUsd === 0 ? '#374151' : '#EF4444' }}>
                                        ${item.totalCostUsd?.toFixed(2)}
                                      </p>
                                      <p className="text-xs" style={{ color: '#4A5174' }}>
                                        ₪{(item.totalCostUsd * rate).toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                                {/* Shipping */}
                                {(analysis.my_cost_breakdown?.shipping_cost ?? 0) > 0 && (
                                  <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: '#1E2130' }}>
                                    <p className="text-sm" style={{ color: '#8B8FA8' }}>משלוח לבית</p>
                                    <p className="text-sm" style={{ color: '#EF4444' }}>${analysis.my_cost_breakdown.shipping_cost?.toFixed(2)}</p>
                                  </div>
                                )}
                                {/* Total */}
                                <div className="flex items-center justify-between px-4 py-3" style={{ background: '#13161F' }}>
                                  <p className="text-sm font-bold text-white">סה"כ עלות</p>
                                  <div className="text-right">
                                    <p className="text-sm font-bold" style={{ color: '#EF4444' }}>${analysis.my_cost_breakdown?.total_usd?.toFixed(2)}</p>
                                    <p className="text-sm font-bold" style={{ color: '#EF4444' }}>₪{analysis.my_cost_ils?.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>
                              {/* Summary row */}
                              <div className="grid grid-cols-3 gap-3 text-sm">
                                {[
                                  { label: 'עלות סוכן',  val: `₪${r.agentCost.toFixed(2)}`,           color: '#CBD5E1' },
                                  { label: 'עלות מערכת', val: `₪${(r.systemCost ?? 0).toFixed(2)}`,   color: '#818CF8' },
                                  { label: 'פער',         val: `₪${r.diff.toFixed(2)}`,                color: r.diff > 0.5 ? '#EF4444' : '#22C55E' },
                                ].map(s => (
                                  <div key={s.label} className="rounded-xl px-3 py-2 text-center" style={{ background: '#13161F', border: '1px solid #1E2130' }}>
                                    <p className="text-xs mb-0.5" style={{ color: '#4A5174' }}>{s.label}</p>
                                    <p className="font-bold" style={{ color: s.color }}>{s.val}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="py-4 text-sm" style={{ color: '#4A5174' }}>
                              {orderData ? 'אין נתוני ניתוח להזמנה זו' : 'הזמנה לא נמצאה במערכת'}
                            </p>
                          )}
                        </div>
                      )}
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

      {/* Business Expenses Section — hidden when filter=business since table shows them */}
      {results && filter !== 'business' && (() => {
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
