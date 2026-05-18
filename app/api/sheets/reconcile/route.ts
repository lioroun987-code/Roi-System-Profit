import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import { getGoogleAuthClient } from '@/lib/sheets'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')

  if (!businessId) return Response.json({ error: 'businessId חסר' }, { status: 400 })

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'לא נמצא' }, { status: 404 })

  const reports = await prisma.reconcileReport.findMany({
    where: { businessId },
    orderBy: { runAt: 'desc' },
    take: 20,
  })

  return Response.json({ reports, businessUpdatedAt: business.updatedAt })
}

const AGENT_COL_ORDER    = 2   // B — מספר הזמנה אצל הסוכן
const AGENT_COL_PRICE    = 11  // K — מחיר
const AGENT_COL_DISCOUNT = 13  // M — הנחה (L=WAR ריק, M=DISCOUNT)
const AGENT_COL_HD       = 14  // N — משלוח לבית
const THRESHOLD          = 0.5

// Keywords that indicate a content creator / photographer order — excluded from gap analysis
const CONTENT_CREATOR_KEYWORDS = ['יוצר תוכן', 'יוצרת תוכן', 'צלם', 'צלמת', 'קונטנט', 'content', 'creator', 'influencer', 'ממותג', 'שיתוף פעולה']

function isContentCreator(reason: string | null): boolean {
  if (!reason) return false
  const lower = reason.toLowerCase()
  return CONTENT_CREATOR_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
}

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
    const { businessId, agentSheetId, agentSheetName, ourSheetId: ourSheetIdOverride, exchangeRate, colMapping } = await request.json()
    const EXCHANGE_RATE = parseFloat(exchangeRate) || 3.4

    // Convert letter (A=1, B=2...) to 0-based index
    const letterToIdx = (letter: string) => letter ? letter.toUpperCase().charCodeAt(0) - 65 : -1

    // Column mapping — defaults match existing hardcoded values
    const COL_ORDER       = letterToIdx(colMapping?.order       || 'B')
    const COL_PRICE       = letterToIdx(colMapping?.price       || 'K')
    const COL_DISCOUNT    = letterToIdx(colMapping?.discount    || 'M')
    const COL_HD          = letterToIdx(colMapping?.homeDelivery|| 'N')
    const COL_WAR         = letterToIdx(colMapping?.warSurcharge|| '')    // -1 = disabled
    const COL_OUR_ORDER   = letterToIdx(colMapping?.ourOrderCol || 'A')   // order# in our sheet
    const COL_OUR_COST    = letterToIdx(colMapping?.ourCostCol  || '')    // our cost in our sheet (-1 = use DB)

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
      let agentRange = 'A2:R2000'
      if (sheetTitle) {
        // Escape single quotes in title
        const escapedTitle = sheetTitle.replace(/'/g, "''")
        agentRange = `'${escapedTitle}'!A2:R2000`
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
          range: 'A2:R2000',
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

    // ── 2. Read main sheet (A=order status context, C=reason/status, up to J) ──
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

    // Build map of order# → col C value (status/reason)
    const colCByOrder = new Map<string, string>()

    // ── 3. Group agent by order number ──
    const agentByOrderUsd = new Map<string, { total: number; war: number; date: string; rows: any[] }>()
    for (const row of agentRows) {
      const orderRaw = row[COL_ORDER]?.toString().trim()
      if (!orderRaw) continue
      if (!/^\d+$/.test(orderRaw.replace('#', '').trim())) continue
      const orderNum = orderRaw.replace('#', '').trim()
      const date     = row[0]?.toString().trim() ?? ''
      const price    = parseFloat(row[COL_PRICE]?.toString().replace(',', '.') ?? '0')    || 0
      const discount = parseFloat(row[COL_DISCOUNT]?.toString().replace(',', '.') ?? '0') || 0
      const hd       = parseFloat(row[COL_HD]?.toString().replace(',', '.') ?? '0')       || 0
      const war      = COL_WAR >= 0 ? (parseFloat(row[COL_WAR]?.toString().replace(',', '.') ?? '0') || 0) : 0
      const existing = agentByOrderUsd.get(orderNum)
      const rowDebug = { price, discount, hd, war, raw: row[COL_PRICE], subtotal: price + discount + hd + war }
      agentByOrderUsd.set(orderNum, {
        total: (existing?.total ?? 0) + price + discount + hd + war,
        war:   (existing?.war   ?? 0) + war,
        date:  existing?.date || date,
        rows:  [...(existing?.rows ?? []), rowDebug],
      })
    }

    // Convert USD → ILS (war surcharge excluded from costIls — shown separately)
    const agentByOrder = new Map<string, { costIls: number; warIls: number; date: string }>()
    for (const [order, data] of agentByOrderUsd) {
      agentByOrder.set(order, {
        costIls: parseFloat(((data.total - data.war) * EXCHANGE_RATE).toFixed(2)),
        warIls:  parseFloat((data.war               * EXCHANGE_RATE).toFixed(2)),
        date:    data.date,
      })
    }

    // ── 4. Parse date range from agent tab name ──
    const dateRange = agentSheetName ? parseDateRange(agentSheetName) : null

    // ── 5. Fetch DB costs — our authoritative cost source (no unreliable sheet detection) ──
    // Filter by date range from agent tab name so we only compare the right month
    const dbOrders = await prisma.order.findMany({
      where: {
        businessId,
        ...(dateRange ? {
          orderDate: { gte: dateRange.start, lte: dateRange.end },
        } : {}),
      },
      select: { orderNumber: true, myCostIls: true, storePrice: true, orderDate: true },
    })
    const dbCostByOrder  = new Map(dbOrders.map(o => [o.orderNumber, o.myCostIls]))
    const dbOrderNumbers = new Set(dbOrders.map(o => o.orderNumber))

    // ── 5b. Scan main sheet only for: order numbers present + column C status/reason ──
    // Find order number column: look for cells matching 3-5 digit numbers,
    // but NOT in same column as dates (avoid confusing years like 2026 with order#).
    let detectedOrderCol = -1
    // Collect all column candidates across first 100 rows, pick most frequent
    const orderColCandidates = new Map<number, number>()
    for (const row of mainRows.slice(0, 100)) {
      for (let c = 0; c < Math.min(row.length, 10); c++) {
        const val = row[c]?.toString().trim() ?? ''
        // Must be 4-5 digits (order numbers are typically >1000) and not look like a year
        if (/^\d{4,5}$/.test(val.replace('#', '')) && parseInt(val) < 90000 && parseInt(val) > 999) {
          orderColCandidates.set(c, (orderColCandidates.get(c) ?? 0) + 1)
        }
      }
    }
    let bestCount = 0
    for (const [col, count] of orderColCandidates) {
      if (count > bestCount) { bestCount = count; detectedOrderCol = col }
    }

    const ourByOrder = new Map<string, { rowIndex: number; sheetCost: number | null }>()
    for (let i = 0; i < mainRows.length; i++) {
      const row      = mainRows[i]
      const orderCol = COL_OUR_ORDER >= 0 ? COL_OUR_ORDER : (detectedOrderCol >= 0 ? detectedOrderCol : 1)
      const orderRaw = row[orderCol]?.toString().trim()
      if (!orderRaw) continue
      const cleaned  = orderRaw.replace('#', '').trim()
      if (!/^\d{3,6}$/.test(cleaned)) continue

      // Read our cost from sheet if column is configured
      let sheetCost: number | null = null
      if (COL_OUR_COST >= 0) {
        const raw = row[COL_OUR_COST]?.toString().replace(/[₪,\s]/g, '').replace(',', '.').trim()
        if (raw && raw !== '' && raw !== '-' && !isNaN(parseFloat(raw))) {
          sheetCost = parseFloat(raw)
        }
      }

      ourByOrder.set(cleaned, { rowIndex: i + 2, sheetCost })

      const colCVal = row[2]?.toString().trim()
      if (colCVal) colCByOrder.set(cleaned, colCVal)
    }

    const detectedCostCol = -1
    const detectedDateCol = -1

    // ── Debug: sample what's in the configured columns ──
    const colDebug = {
      ourOrderCol:  COL_OUR_ORDER,
      ourCostCol:   COL_OUR_COST,
      sampleRows:   mainRows.slice(0, 3).map(row => ({
        orderVal: row[COL_OUR_ORDER]?.toString() ?? '(empty)',
        costVal:  COL_OUR_COST >= 0 ? (row[COL_OUR_COST]?.toString() ?? '(empty)') : 'לא מוגדר',
      })),
      totalOurRows: ourByOrder.size,
    }

    // ── 6. Compare ──
    const results: any[] = []
    const sheetUpdates: { range: string; value: string; color: any }[] = []

    for (const [orderNum, agentData] of agentByOrder) {
      const agentCost  = agentData.costIls
      const warIls     = agentData.warIls
      const orderDate  = agentData.date

      // If agent wrote $0 → they didn't charge for this order — show as match, no comparison
      if (agentCost <= 0) {
        results.push({
          orderNumber: orderNum, agentCost: 0, warIls, ourCost: 0, systemCost: 0,
          diff: 0, status: 'match', rowIndex: ourByOrder.get(orderNum)?.rowIndex ?? -1,
          orderDate, sheetReason: colCByOrder.get(orderNum) ?? null,
        })
        continue
      }

      const dbCost     = dbCostByOrder.get(orderNum) ?? null
      const sheetEntry = ourByOrder.get(orderNum)
      const ourCost    = (COL_OUR_COST >= 0 && sheetEntry?.sheetCost != null)
        ? sheetEntry.sheetCost
        : dbCost
      const systemCost = dbCost

      // Primary: compare agent vs system (DB) — determines agent discrepancy
      const agentVsSystem = systemCost != null ? Math.abs(agentCost - systemCost) : null
      // Secondary: compare our sheet vs system — personal discrepancy
      const sheetVsSystem = (ourCost != null && systemCost != null && ourCost !== systemCost)
        ? Math.abs(ourCost - systemCost)
        : 0

      let status: string
      let diff: number

      const sheetReason = colCByOrder.get(orderNum) ?? null

      if (agentVsSystem == null) {
        status = 'missing_our_cost'; diff = 0
      } else if (agentVsSystem <= THRESHOLD) {
        // Agent matches system — check if our sheet differs from system
        if (sheetVsSystem > THRESHOLD) {
          status = 'personal_diff'; diff = sheetVsSystem
        } else {
          status = 'match'; diff = agentVsSystem
        }
      } else if (agentCost > (systemCost ?? 0)) {
        status = 'agent_higher'; diff = agentVsSystem
      } else {
        status = 'we_higher'; diff = agentVsSystem
      }

      if (isContentCreator(sheetReason)) status = 'content_creator'

      const rowIdx = ourByOrder.get(orderNum)?.rowIndex ?? -1
      results.push({ orderNumber: orderNum, agentCost, warIls, ourCost, systemCost, diff, status, rowIndex: rowIdx, orderDate, sheetReason })
    }

    // Orders in DB (for this month) but missing from agent sheet
    for (const orderNum of dbOrderNumbers) {
      if (!agentByOrder.has(orderNum)) {
        const ourCost = dbCostByOrder.get(orderNum) ?? null
        results.push({
          orderNumber: orderNum,
          agentCost:   0,
          ourCost,
          systemCost:  ourCost,
          diff:        0,
          status:      'missing_in_agent',
          rowIndex:    ourByOrder.get(orderNum)?.rowIndex ?? -1,
          sheetReason: colCByOrder.get(orderNum) ?? null,
        })
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

    const agentKeys = Array.from(agentByOrder.keys())
    const dbKeys    = Array.from(dbOrderNumbers)

    const directMatchTest = agentKeys.slice(0, 3).map(k => ({
      key:   k,
      inOur: dbOrderNumbers.has(k),
    }))
    const debug = {
      agentFirst5: agentKeys.slice(0, 5),
      agentLast5:  agentKeys.slice(-5),
      ourFirst5:   dbKeys.slice(0, 5),
      ourLast5:    dbKeys.slice(-5),
      agentTotal:  agentByOrder.size,
      ourTotal:    dbOrderNumbers.size,
      dateRangeParsed: dateRange ? `${dateRange.start.toISOString().split('T')[0]} → ${dateRange.end.toISOString().split('T')[0]}` : 'לא פורסר',
      detectedCols: `מספרהזמנה=עמודה ${detectedOrderCol >= 0 ? String.fromCharCode(65 + detectedOrderCol) : '?'} | עלות = DB (myCostIls)`,
      directMatchTest,
      rawDateSamples:   [],
      rawOrderSamples:  [],
      colDebug,
    }

    // ── 7. Save report to DB ──
    try {
      // Delete existing report for this businessId + tab (keep one per tab)
      if (agentSheetName) {
        await prisma.reconcileReport.deleteMany({ where: { businessId, agentSheetName } })
      } else {
        await prisma.reconcileReport.deleteMany({ where: { businessId, agentSheetId, agentSheetName: null } })
      }
      await prisma.reconcileReport.create({
        data: {
          businessId,
          agentSheetId,
          agentSheetName: agentSheetName || null,
          ourSheetId: mainSheetId,
          exchangeRate: EXCHANGE_RATE,
          results,
          summary,
          debug,
          businessUpdatedAt: business.updatedAt,
        },
      })
    } catch (e) {
      console.error('Save reconcile report failed (non-fatal):', e)
    }

    return Response.json({ results, summary, debug })

  } catch (err: any) {
    console.error('Reconcile error:', err)
    return Response.json({ error: `שגיאה: ${err?.message ?? 'לא ידועה'}` }, { status: 500 })
  }
}
