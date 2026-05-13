import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import { getGoogleAuthClient } from '@/lib/sheets'

// Agent sheet columns (1-based)
const AGENT_COL_ORDER   = 2   // B — Order Number
const AGENT_COL_PRICE   = 11  // K — PRICE
const AGENT_COL_DISCOUNT = 12 // L — DISCOUNT
const AGENT_COL_HD      = 13  // M — Home Delivery surcharge

// Our main sheet columns
const MAIN_COL_ORDER    = 1   // A — מספר הזמנה
const MAIN_COL_OUR_COST = 7   // G — עלות שלי
const MAIN_COL_STATUS   = 9   // I — סטטוס פערים (נכתוב לשם)

const THRESHOLD = 0.5 // פער קטן מ-0.5₪ נחשב זהה

export interface ReconcileResult {
  orderNumber: string
  agentCost: number
  ourCost: number | null
  diff: number
  status: 'match' | 'agent_higher' | 'we_higher' | 'missing_our_cost' | 'missing_in_agent'
  rowIndex: number
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId, agentSheetId, agentSheetName, ourSheetId: ourSheetIdOverride } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })
  if (!business.googleRefreshToken) return Response.json({ error: 'Google Sheets לא מחובר' }, { status: 400 })
  if (!business.googleSheetsId) return Response.json({ error: 'גיליון ראשי לא מוגדר' }, { status: 400 })

  const auth = getGoogleAuthClient(business.googleRefreshToken)
  const sheets = google.sheets({ version: 'v4', auth })

  // ── 1. Read agent sheet ──
  const agentRange = agentSheetName ? `${agentSheetName}!A2:M2000` : 'A2:M2000'
  const agentRes = await sheets.spreadsheets.values.get({
    spreadsheetId: agentSheetId,
    range: agentRange,
  })
  const agentRows = agentRes.data.values ?? []

  // ── 2. Group agent rows by order number ──
  const agentByOrder = new Map<string, { price: number; discount: number; hd: number }>()

  for (const row of agentRows) {
    const orderRaw = row[AGENT_COL_ORDER - 1]?.toString().trim()
    if (!orderRaw) continue
    const orderNum = orderRaw.replace('#', '').trim()

    const price    = parseFloat(row[AGENT_COL_PRICE - 1]?.toString().replace(',', '.') ?? '0') || 0
    const discount = parseFloat(row[AGENT_COL_DISCOUNT - 1]?.toString().replace(',', '.') ?? '0') || 0
    const hd       = parseFloat(row[AGENT_COL_HD - 1]?.toString().replace(',', '.') ?? '0') || 0

    const existing = agentByOrder.get(orderNum) ?? { price: 0, discount: 0, hd: 0 }
    agentByOrder.set(orderNum, {
      price:    existing.price + price,
      discount: existing.discount + discount,
      hd:       existing.hd + (hd || 0),
    })
  }

  // ── 3. Read our main sheet ──
  const mainRes = await sheets.spreadsheets.values.get({
    spreadsheetId: business.googleSheetsId,
    range: 'A2:I1000',
  })
  const mainRows = mainRes.data.values ?? []

  // Build map: orderNumber → { ourCost, rowIndex }
  const ourByOrder = new Map<string, { cost: number | null; rowIndex: number }>()
  for (let i = 0; i < mainRows.length; i++) {
    const orderRaw = mainRows[i][MAIN_COL_ORDER - 1]?.toString().trim()
    if (!orderRaw) continue
    const orderNum = orderRaw.replace('#', '').trim()
    const costRaw  = mainRows[i][MAIN_COL_OUR_COST - 1]?.toString().replace(',', '.').trim()
    ourByOrder.set(orderNum, {
      cost: costRaw ? parseFloat(costRaw) : null,
      rowIndex: i + 2,
    })
  }

  // ── 4. Compare ──
  const results: ReconcileResult[] = []
  const sheetUpdates: { range: string; value: string; color: { red: number; green: number; blue: number } }[] = []

  // Check all agent orders against ours
  for (const [orderNum, agentData] of agentByOrder) {
    const agentCost = agentData.price + agentData.discount + agentData.hd
    const ourData = ourByOrder.get(orderNum)

    if (!ourData) {
      results.push({ orderNumber: orderNum, agentCost, ourCost: null, diff: 0, status: 'missing_our_cost', rowIndex: -1 })
      continue
    }

    const ourCost = ourData.cost
    const diff = ourCost != null ? Math.abs(agentCost - ourCost) : 0

    let status: ReconcileResult['status']
    if (ourCost == null) {
      status = 'missing_our_cost'
    } else if (diff <= THRESHOLD) {
      status = 'match'
    } else if (agentCost > ourCost) {
      status = 'agent_higher'
    } else {
      status = 'we_higher'
    }

    results.push({ orderNumber: orderNum, agentCost, ourCost, diff, status, rowIndex: ourData.rowIndex })

    // Prepare sheet update for column I
    if (ourData.rowIndex > 0) {
      let statusText = ''
      let color = { red: 0, green: 0.8, blue: 0 }

      if (status === 'match') {
        statusText = '✓ תואם'
        color = { red: 0.2, green: 0.7, blue: 0.2 }
      } else if (status === 'agent_higher') {
        statusText = `⚠️ סוכן גבוה ב-₪${diff.toFixed(2)}`
        color = { red: 0.9, green: 0.4, blue: 0 }
      } else if (status === 'we_higher') {
        statusText = `⚠️ חישוב שלנו גבוה ב-₪${diff.toFixed(2)}`
        color = { red: 0.9, green: 0.6, blue: 0 }
      } else if (status === 'missing_our_cost') {
        statusText = '⏳ עלות לא חושבה'
        color = { red: 0.7, green: 0.7, blue: 0.7 }
      }

      sheetUpdates.push({ range: `I${ourData.rowIndex}`, value: statusText, color })
    }
  }

  // Check orders in our sheet missing from agent
  for (const [orderNum, ourData] of ourByOrder) {
    if (!agentByOrder.has(orderNum) && ourData.cost != null) {
      results.push({ orderNumber: orderNum, agentCost: 0, ourCost: ourData.cost, diff: 0, status: 'missing_in_agent', rowIndex: ourData.rowIndex })
    }
  }

  // ── 5. Write status column back to main sheet ──
  if (sheetUpdates.length > 0) {
    // Write values
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: business.googleSheetsId,
      requestBody: {
        valueInputOption: 'RAW',
        data: sheetUpdates.map(u => ({ range: u.range, values: [[u.value]] })),
      },
    })

    // Color cells based on status
    const requests = sheetUpdates.map(u => ({
      repeatCell: {
        range: {
          sheetId: 0,
          startRowIndex: parseInt(u.range.replace(/\D/g, '')) - 1,
          endRowIndex: parseInt(u.range.replace(/\D/g, '')),
          startColumnIndex: 8, // Column I
          endColumnIndex: 9,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { ...u.color, alpha: 1 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1, alpha: 1 }, bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    }))

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: business.googleSheetsId,
      requestBody: { requests },
    })
  }

  const summary = {
    total: results.length,
    matches: results.filter(r => r.status === 'match').length,
    agentHigher: results.filter(r => r.status === 'agent_higher').length,
    weHigher: results.filter(r => r.status === 'we_higher').length,
    missingCost: results.filter(r => r.status === 'missing_our_cost').length,
  }

  return Response.json({ results, summary })
}
