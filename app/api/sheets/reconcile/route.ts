import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import { getGoogleAuthClient } from '@/lib/sheets'

const AGENT_COL_ORDER    = 2   // B — מספר הזמנה אצל הסוכן
const AGENT_COL_PRICE    = 11  // K — מחיר
const AGENT_COL_DISCOUNT = 12  // L — הנחה
const AGENT_COL_HD       = 13  // M — משלוח לבית
const THRESHOLD          = 0.5

// Parse date range from agent tab name: "הזמנות 01/02 - 28/02" or "01/02 - 28/02"
function parseDateRange(tabName: string): { start: Date; end: Date } | null {
  const year = new Date().getFullYear()
  // Find all DD/MM pairs in the string
  const allMatches = [...tabName.matchAll(/(\d{1,2})\/(\d{1,2})/g)]
  if (allMatches.length < 2) {
    // Try to extract just the month from a single date
    if (allMatches.length === 1) {
      const [, d, m] = allMatches[0]
      const date = new Date(year, parseInt(m) - 1, parseInt(d))
      return {
        start: new Date(year, date.getMonth(), 1),
        end: new Date(year, date.getMonth() + 1, 0, 23, 59, 59),
      }
    }
    return null
  }
  // Build two dates and take the earlier as start
  const dates = allMatches.map(m => new Date(year, parseInt(m[2]) - 1, parseInt(m[1])))
  const dateA = dates[0]
  const dateB = dates[1]
  const start = dateA < dateB ? dateA : dateB
  const end   = dateA < dateB ? dateB : dateA
  end.setHours(23, 59, 59)
  // Handle year boundary (Dec→Jan)
  if (end < start) end.setFullYear(year + 1)
  return { start, end }
}

function parseDate(val: string): Date | null {
  if (!val) return null
  const s = val.trim()
  const currentYear = new Date().getFullYear()

  // "2026-01-31" or "2026-01-31 19:30"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.split(' ')[0])

  // "31/01/2026" or "31/01/26" (with optional time after)
  const slashFull = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (slashFull) {
    const [, d, m, y] = slashFull
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
    return new Date(year, parseInt(m) - 1, parseInt(d))
  }

  // "31.01.2026" or "31.01.26" (with optional time after)
  const dotFull = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (dotFull) {
    const [, d, m, y] = dotFull
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
    return new Date(year, parseInt(m) - 1, parseInt(d))
  }

  // "31.01" or "1.2" (with optional space/time after) — dot = LAST YEAR
  const dotShort = s.match(/^(\d{1,2})\.(\d{1,2})(?:\s|$)/)
  if (dotShort) {
    const [, d, m] = dotShort
    return new Date(currentYear - 1, parseInt(m) - 1, parseInt(d))
  }

  // "31/01" or "01/02" (with optional space/time after) — slash = THIS YEAR
  const slashShort = s.match(/^(\d{1,2})\/(\d{1,2})(?:\s|$)/)
  if (slashShort) {
    const [, d, m] = slashShort
    return new Date(currentYear, parseInt(m) - 1, parseInt(d))
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const { businessId, agentSheetId, agentSheetName, ourSheetId: ourSheetIdOverride, exchangeRate } = await request.json()
    const EXCHANGE_RATE = parseFloat(exchangeRate) || 3.4

    if (!businessId) return Response.json({ error: 'businessId חסר' }, { status: 400 })
    if (!agentSheetId) return Response.json({ error: 'מזהה גיליון הסוכן חסר' }, { status: 400 })

    const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
    if (!business) return Response.json({ error: 'העסק לא נמצא' }, { status: 404 })
    if (!business.googleRefreshToken) return Response.json({ error: 'Google Sheets לא מחובר — חבר באינטגרציות' }, { status: 400 })

    const mainSheetId = ourSheetIdOverride || business.googleSheetsId
    if (!mainSheetId) return Response.json({ error: 'הכנס מזהה גיליון שלך בשדה למעלה' }, { status: 400 })

    const auth = getGoogleAuthClient(business.googleRefreshToken)
    const sheets = google.sheets({ version: 'v4', auth })

    // ── 1. Read agent sheet ──
    let agentRows: any[][] = []
    try {
      // First: get sheet metadata to find the correct sheet name/id
      const meta = await sheets.spreadsheets.get({ spreadsheetId: agentSheetId })
      const sheetsList = meta.data.sheets ?? []

      let targetSheetId: number | undefined
      if (agentSheetName) {
        // Find sheet by name (case-insensitive, ignore slashes difference)
        const found = sheetsList.find(s =>
          s.properties?.title?.replace(/\//g, '') === agentSheetName.replace(/\//g, '') ||
          s.properties?.title === agentSheetName
        )
        targetSheetId = (found?.properties?.sheetId ?? sheetsList[0]?.properties?.sheetId) ?? undefined
      } else {
        targetSheetId = sheetsList[0]?.properties?.sheetId ?? undefined
      }

      // Use numeric sheetId to avoid name parsing issues
      const sheetTitle = sheetsList.find(s => s.properties?.sheetId === targetSheetId)?.properties?.title ?? ''

      // Try by title first, fallback to just range
      let agentRange = 'A2:M2000'
      if (sheetTitle) {
        // Escape single quotes in title
        const escapedTitle = sheetTitle.replace(/'/g, "''")
        agentRange = `'${escapedTitle}'!A2:M2000`
      }

      try {
        const agentRes = await sheets.spreadsheets.values.get({
          spreadsheetId: agentSheetId,
          range: agentRange,
        })
        agentRows = agentRes.data.values ?? []
      } catch {
        // Fallback: try without sheet name
        const fallbackRes = await sheets.spreadsheets.values.get({
          spreadsheetId: agentSheetId,
          range: 'A2:M2000',
        })
        agentRows = fallbackRes.data.values ?? []
      }
    } catch (e: any) {
      const msg = e?.message ?? ''
      if (msg.includes('403') || msg.includes('permission')) {
        return Response.json({ error: 'אין גישה לגיליון הסוכן — ודא שהגיליון משותף עם החשבון שלך' }, { status: 400 })
      }
      if (msg.includes('404') || msg.includes('not found')) {
        return Response.json({ error: 'גיליון הסוכן לא נמצא — בדוק את המזהה' }, { status: 400 })
      }
      return Response.json({ error: `שגיאה בקריאת גיליון הסוכן: ${msg}` }, { status: 400 })
    }

    // ── 2. Read main sheet ──
    let mainRows: any[][] = []
    try {
      const mainRes = await sheets.spreadsheets.values.get({
        spreadsheetId: mainSheetId,
        range: 'A2:J10000',
      })
      mainRows = mainRes.data.values ?? []
    } catch (e: any) {
      const msg = e?.message ?? ''
      return Response.json({ error: `שגיאה בקריאת הגיליון שלך: ${msg}` }, { status: 400 })
    }

    // ── 3. Group agent by order number: SUM(K+L+M) in USD → convert to ILS ──
    const agentByOrderUsd = new Map<string, { total: number; date: string }>()
    for (const row of agentRows) {
      const orderRaw = row[AGENT_COL_ORDER - 1]?.toString().trim()
      if (!orderRaw) continue
      // Skip rows where column B is not a number (e.g., customer names, headers)
      if (!/^\d+$/.test(orderRaw.replace('#', '').trim())) continue
      const orderNum = orderRaw.replace('#', '').trim()
      const date     = row[0]?.toString().trim() ?? ''  // Column A = Order Creation Date
      const price    = parseFloat(row[AGENT_COL_PRICE    - 1]?.toString().replace(',', '.') ?? '0') || 0
      const discount = parseFloat(row[AGENT_COL_DISCOUNT - 1]?.toString().replace(',', '.') ?? '0') || 0
      const hd       = parseFloat(row[AGENT_COL_HD       - 1]?.toString().replace(',', '.') ?? '0') || 0
      const existing = agentByOrderUsd.get(orderNum)
      agentByOrderUsd.set(orderNum, {
        total: (existing?.total ?? 0) + price + discount + hd,
        date: existing?.date || date,
      })
    }

    // Convert USD → ILS
    const agentByOrder = new Map<string, { costIls: number; date: string }>()
    for (const [order, data] of agentByOrderUsd) {
      agentByOrder.set(order, {
        costIls: parseFloat((data.total * EXCHANGE_RATE).toFixed(2)),
        date: data.date,
      })
    }

    // ── 4. Auto-detect columns: scan first 50 rows to find date & order columns ──
    const dateRange = agentSheetName ? parseDateRange(agentSheetName) : null

    let detectedDateCol = -1
    let detectedOrderCol = -1
    let detectedCostCol = -1

    for (const row of mainRows.slice(0, 100)) {
      for (let c = 0; c < row.length; c++) {
        const val = row[c]?.toString().trim() ?? ''
        if (detectedDateCol === -1 && parseDate(val) !== null) {
          detectedDateCol = c
        }
        if (detectedOrderCol === -1 && /^\d{3,5}$/.test(val.replace('#', ''))) {
          detectedOrderCol = c
        }
        if (detectedCostCol === -1 && /^\d{1,4}(\.\d{1,2})?$/.test(val) && parseFloat(val) > 10 && parseFloat(val) < 1000) {
          if (detectedOrderCol !== -1 && c !== detectedOrderCol && c !== detectedDateCol) {
            detectedCostCol = c
          }
        }
      }
      if (detectedDateCol >= 0 && detectedOrderCol >= 0) break
    }

    const ourByOrder = new Map<string, { cost: number | null; rowIndex: number }>()
    for (let i = 0; i < mainRows.length; i++) {
      const row = mainRows[i]

      // Filter by month/year from agent tab
      if (dateRange && detectedDateCol >= 0) {
        const dateVal = row[detectedDateCol]?.toString().trim()
        const rowDate = parseDate(dateVal ?? '')
        if (!rowDate) continue
        const sameMonth = rowDate.getMonth() === dateRange.start.getMonth()
        const sameYear  = rowDate.getFullYear() === dateRange.start.getFullYear()
        if (!sameMonth || !sameYear) continue
      }

      const colIdx = detectedOrderCol >= 0 ? detectedOrderCol : 8
      const orderRaw = row[colIdx]?.toString().trim()
      if (!orderRaw) continue
      if (!/^\d+$/.test(orderRaw.replace('#', '').trim())) continue
      const orderNum = orderRaw.replace('#', '').trim()

      const costIdx = detectedCostCol >= 0 ? detectedCostCol : 6
      const costRaw = row[costIdx]?.toString().replace(',', '.').trim()
      ourByOrder.set(orderNum, {
        cost: costRaw && costRaw !== '' ? parseFloat(costRaw) : null,
        rowIndex: i + 2,
      })
    }

    // ── 5. Compare ──
    const results: any[] = []
    const sheetUpdates: { range: string; value: string; color: any }[] = []

    for (const [orderNum, agentData] of agentByOrder) {
      const agentCost = agentData.costIls
      const orderDate = agentData.date
      const ourData = ourByOrder.get(orderNum)
      const ourCost = ourData?.cost ?? null
      const diff = ourCost != null ? Math.abs(agentCost - ourCost) : 0

      let status: string
      if (ourCost == null) status = 'missing_our_cost'
      else if (diff <= THRESHOLD) status = 'match'
      else if (agentCost > ourCost) status = 'agent_higher'
      else status = 'we_higher'

      results.push({ orderNumber: orderNum, agentCost, ourCost, diff, status, rowIndex: ourData?.rowIndex ?? -1, orderDate })

      // No longer writing to user's sheet to avoid overwriting columns
    }

    for (const [orderNum, ourData] of ourByOrder) {
      if (!agentByOrder.has(orderNum) && ourData.cost != null) {
        results.push({ orderNumber: orderNum, agentCost: 0, ourCost: ourData.cost, diff: 0, status: 'missing_in_agent', rowIndex: ourData.rowIndex })
      }
    }

    // ── 6. Write status back to main sheet ──
    if (sheetUpdates.length > 0) {
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: mainSheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: sheetUpdates.map(u => ({ range: u.range, values: [[u.value]] })),
          },
        })

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: mainSheetId,
          requestBody: {
            requests: sheetUpdates.map(u => ({
              repeatCell: {
                range: { sheetId: 0, startRowIndex: parseInt(u.range.replace(/\D/g, '')) - 1, endRowIndex: parseInt(u.range.replace(/\D/g, '')), startColumnIndex: 8, endColumnIndex: 9 },
                cell: { userEnteredFormat: { backgroundColor: { ...u.color, alpha: 1 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1, alpha: 1 }, bold: true } } },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            })),
          },
        })
      } catch (e) {
        console.error('Sheet write error (non-fatal):', e)
      }
    }

    const summary = {
      total: results.length,
      matches: results.filter(r => r.status === 'match').length,
      agentHigher: results.filter(r => r.status === 'agent_higher').length,
      weHigher: results.filter(r => r.status === 'we_higher').length,
      missingCost: results.filter(r => r.status === 'missing_our_cost').length,
    }

    // Direct match test
    const agentSample3 = agentKeys.slice(0, 3)
    const directMatchTest = agentSample3.map(k => ({
      key: k,
      inOur: ourByOrder.has(k),
      ourRaw: JSON.stringify([...ourByOrder.entries()].find(([ok]) => ok === k)?.[0] ?? 'not found'),
    }))

    const colLetter = (n: number) => n < 0 ? '?' : String.fromCharCode(65 + n)
    const rawDateSamples = mainRows.slice(0, 5).map(r => r[detectedDateCol]?.toString() ?? '')
    const rawOrderSamples = mainRows.slice(0, 5).map(r => r[detectedOrderCol]?.toString() ?? '')
    const agentKeys = Array.from(agentByOrder.keys())
    const ourKeys   = Array.from(ourByOrder.keys())
    const debug = {
      agentFirst5: agentKeys.slice(0, 5),
      agentLast5:  agentKeys.slice(-5),
      ourFirst5:   ourKeys.slice(0, 5),
      ourLast5:    ourKeys.slice(-5),
      agentTotal:  agentByOrder.size,
      ourTotal:    ourByOrder.size,
      dateRangeParsed: dateRange ? `${dateRange.start.toISOString().split('T')[0]} → ${dateRange.end.toISOString().split('T')[0]}` : 'לא פורסר',
      detectedCols: `תאריך=עמודה ${colLetter(detectedDateCol)}, מספרהזמנה=עמודה ${colLetter(detectedOrderCol)}, עלות=עמודה ${colLetter(detectedCostCol)}`,
      directMatchTest,
      rawDateSamples,
      rawOrderSamples,
    }

    return Response.json({ results, summary, debug })

  } catch (err: any) {
    console.error('Reconcile error:', err)
    return Response.json({ error: `שגיאה: ${err?.message ?? 'לא ידועה'}` }, { status: 500 })
  }
}
