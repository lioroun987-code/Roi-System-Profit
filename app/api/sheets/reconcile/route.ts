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
const MAIN_COL_DATE      = 2   // B — תאריך בגיליון שלך
const MAIN_COL_ORDER     = 9   // I — מספר הזמנה שלך
const MAIN_COL_OUR_COST  = 7   // G — עלות שלי
const THRESHOLD          = 0.5

// Parse date range from agent tab name: "הזמנות 01/02 - 28/02" or "01/02 - 28/02"
function parseDateRange(tabName: string): { start: Date; end: Date } | null {
  const match = tabName.match(/(\d{2})\/(\d{2})\s*[-–]\s*(\d{2})\/(\d{2})/)
  if (!match) return null
  const year = new Date().getFullYear()
  const [, d1, m1, d2, m2] = match
  const start = new Date(year, parseInt(m1) - 1, parseInt(d1), 0, 0, 0)
  const end   = new Date(year, parseInt(m2) - 1, parseInt(d2), 23, 59, 59)
  // Handle year boundary (e.g. Dec→Jan)
  if (end < start) end.setFullYear(year + 1)
  return { start, end }
}

function parseDate(val: string): Date | null {
  if (!val) return null
  // Support: "2026-01-31", "31/01/2026", "2026-01-31 19:..."
  const clean = val.split(' ')[0].trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return new Date(clean)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(clean)) {
    const [d, m, y] = clean.split('/')
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
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
        range: 'A2:J1000',
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

    // ── 4. Build our cost map — filtered by date range from agent tab ──
    const dateRange = agentSheetName ? parseDateRange(agentSheetName) : null

    const ourByOrder = new Map<string, { cost: number | null; rowIndex: number }>()
    for (let i = 0; i < mainRows.length; i++) {
      const row = mainRows[i]

      // Filter by date if we have a range
      if (dateRange) {
        const dateVal = row[MAIN_COL_DATE - 1]?.toString().trim()
        const rowDate = parseDate(dateVal)
        if (!rowDate || rowDate < dateRange.start || rowDate > dateRange.end) continue
      }

      const orderRaw = row[MAIN_COL_ORDER - 1]?.toString().trim()
      if (!orderRaw) continue
      if (!/^\d+$/.test(orderRaw.replace('#', '').trim())) continue
      const orderNum = orderRaw.replace('#', '').trim()
      const costRaw  = row[MAIN_COL_OUR_COST - 1]?.toString().replace(',', '.').trim()
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

      if (ourData && ourData.rowIndex > 0) {
        const texts: Record<string, string> = {
          match:            '✓ תואם',
          agent_higher:     `⚠️ סוכן גבוה ב-₪${diff.toFixed(2)}`,
          we_higher:        `⚠️ שלנו גבוה ב-₪${diff.toFixed(2)}`,
          missing_our_cost: '⏳ חסרה עלות',
        }
        const colors: Record<string, any> = {
          match:            { red: 0.2, green: 0.7, blue: 0.2 },
          agent_higher:     { red: 0.9, green: 0.5, blue: 0.0 },
          we_higher:        { red: 0.9, green: 0.6, blue: 0.0 },
          missing_our_cost: { red: 0.5, green: 0.5, blue: 0.5 },
        }
        sheetUpdates.push({
          range: `I${ourData.rowIndex}`,
          value: texts[status] ?? status,
          color: colors[status] ?? { red: 0.5, green: 0.5, blue: 0.5 },
        })
      }
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

    // Debug: sample order numbers from each sheet
    const debug = {
      agentSample: Array.from(agentByOrder.keys()).slice(0, 5),
      ourSample: Array.from(ourByOrder.keys()).slice(0, 5),
      agentTotal: agentByOrder.size,
      ourTotal: ourByOrder.size,
    }

    return Response.json({ results, summary, debug })

  } catch (err: any) {
    console.error('Reconcile error:', err)
    return Response.json({ error: `שגיאה: ${err?.message ?? 'לא ידועה'}` }, { status: 500 })
  }
}
