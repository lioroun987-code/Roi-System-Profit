import { google } from 'googleapis'
import { OrderRow } from '@/types'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

/* ── Orders sheet layout (matches the Make automation the user is replacing) ──
   A = customer full name | B = order date (D/M) | E = store price (customer paid)
   G = my cost            | I = order number (#N)  | C,D,F,H = unused
──────────────────────────────────────────────────────────────────────────── */
const SHEET_ORDER_COL = 8   // I (0-based) — order number
const SHEET_COST_COL  = 6   // G (0-based) — my cost

export interface SheetOrderRow {
  orderNumber: string          // raw Shopify order_number, e.g. "1234"
  customerName: string | null
  orderDate: Date
  storePriceIls: number | null // what the customer paid
  myCostIls: number
}

// Format a date as "11/3" (day/month, no leading zeros) in Israel time,
// regardless of server timezone.
function formatSheetDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit',
  }).formatToParts(d)
  const day   = parseInt(parts.find(p => p.type === 'day')?.value ?? '0', 10)
  const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '0', 10)
  return `${day}/${month}`
}

/**
 * Writes an order into the orders sheet, replacing the external Make automation:
 * - If a row for this order already exists (matched by order number in column I),
 *   fill its cost cell (G) only when empty — never overwrite an existing cost.
 * - Otherwise append a full new row in the Make layout (A/B/E/G/I populated).
 * Returns what it did, for logging.
 */
export async function upsertOrderRowInSheet(
  refreshToken: string,
  spreadsheetId: string,
  row: SheetOrderRow
): Promise<'appended' | 'filled' | 'skipped'> {
  const auth = getGoogleAuthClient(refreshToken)
  const sheets = google.sheets({ version: 'v4', auth })
  const wanted = row.orderNumber.replace('#', '').trim()

  // Read A..I (absolute indices, unbounded) to locate an existing row.
  const readRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A2:I' })
  const rows = readRes.data.values ?? []

  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i]?.[SHEET_ORDER_COL]?.toString().replace('#', '').trim()
    if (cell !== wanted) continue

    // Row already exists — only fill the cost cell when it's still empty.
    const existingCost = rows[i]?.[SHEET_COST_COL]?.toString().trim()
    if (existingCost) return 'skipped'
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `G${i + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[row.myCostIls.toFixed(2)]] },
    })
    return 'filled'
  }

  // No existing row — append a full one matching the Make column layout.
  const values = [
    row.customerName ?? '',                                       // A
    formatSheetDate(row.orderDate),                               // B
    '',                                                           // C
    '',                                                           // D
    row.storePriceIls != null ? row.storePriceIls.toFixed(2) : '', // E
    '',                                                           // F
    row.myCostIls.toFixed(2),                                     // G
    '',                                                           // H
    `#${wanted}`,                                                 // I
  ]
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'A2',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  })
  return 'appended'
}

export function getGoogleAuthClient(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_SHEETS_CLIENT_ID,
    process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    process.env.GOOGLE_SHEETS_REDIRECT_URI
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}

export async function createOrGetSheet(
  auth: ReturnType<typeof getGoogleAuthClient>,
  spreadsheetId: string,
  sheetName: string
): Promise<number> {
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })

  const existingSheet = spreadsheet.data.sheets?.find(
    s => s.properties?.title === sheetName
  )

  if (existingSheet) return existingSheet.properties?.sheetId ?? 0

  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  })

  return res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0
}

const ORDER_HEADERS = [
  'מספר הזמנה',
  'תאריך',
  'סיכום הזמנה',
  'מחיר חנות (₪)',
  'עלות שלי ($)',
  'עלות שלי (₪)',
  'רווח גולמי (₪)',
  'עמלת תשלום (₪)',
  'מע"מ (₪)',
  'הוצאות פרסום (₪)',
  'רווח נקי (₪)',
  'אמצעי תשלום',
]

export async function exportOrdersToSheet(
  refreshToken: string,
  spreadsheetId: string,
  orders: OrderRow[]
): Promise<void> {
  const auth = getGoogleAuthClient(refreshToken)
  const sheets = google.sheets({ version: 'v4', auth })

  await createOrGetSheet(auth, spreadsheetId, 'הזמנות')

  const existingRows = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'הזמנות!A:A',
  })

  const existingOrderNumbers = new Set(
    (existingRows.data.values ?? []).slice(1).map(r => r[0])
  )

  const newOrders = orders.filter(o => !existingOrderNumbers.has(o.orderNumber))
  if (newOrders.length === 0) return

  const rows = newOrders.map(o => [
    o.orderNumber,
    new Date(o.orderDate).toLocaleDateString('he-IL'),
    o.orderSummary ?? '',
    o.storePrice?.toFixed(2) ?? '',
    o.myCostUsd?.toFixed(2) ?? '',
    o.myCostIls?.toFixed(2) ?? '',
    o.grossProfitIls?.toFixed(2) ?? '',
    o.paymentFeeIls?.toFixed(2) ?? '',
    o.vatIls?.toFixed(2) ?? '',
    o.adSpendAlloc?.toFixed(2) ?? '',
    o.netProfitIls?.toFixed(2) ?? '',
    o.paymentMethod ?? '',
  ])

  const existingCount = (existingRows.data.values ?? []).length
  if (existingCount <= 1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'הזמנות!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [ORDER_HEADERS, ...rows] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'הזמנות!A1',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    })
  }
}

export async function updateSummarySheet(
  refreshToken: string,
  spreadsheetId: string,
  dailyData: Array<{
    date: string
    revenue: number
    cost: number
    profit: number
    adSpend: number
    orders: number
  }>
): Promise<void> {
  const auth = getGoogleAuthClient(refreshToken)
  const sheets = google.sheets({ version: 'v4', auth })

  await createOrGetSheet(auth, spreadsheetId, 'סיכום יומי')

  const headers = ['תאריך', 'הכנסות (₪)', 'עלויות (₪)', 'רווח גולמי (₪)', 'הוצאות פרסום (₪)', 'רווח נקי (₪)', 'הזמנות', 'ROAS']
  const rows = dailyData.map(d => [
    d.date,
    d.revenue.toFixed(2),
    d.cost.toFixed(2),
    d.profit.toFixed(2),
    d.adSpend.toFixed(2),
    (d.profit - d.adSpend).toFixed(2),
    d.orders,
    d.adSpend > 0 ? (d.revenue / d.adSpend).toFixed(2) : 'N/A',
  ])

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'סיכום יומי!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows] },
  })
}

function getRedirectUri(): string {
  const base = process.env.GOOGLE_SHEETS_REDIRECT_URI
    || `${process.env.NEXTAUTH_URL}/api/sheets/callback`
  return base
}

export function getOAuthUrl(state?: string): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_SHEETS_CLIENT_ID,
    process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    getRedirectUri()
  )
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    ...(state && { state }),
  })
}

export async function exchangeCodeForTokens(code: string): Promise<{ access_token: string; refresh_token: string }> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_SHEETS_CLIENT_ID,
    process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    getRedirectUri()
  )
  const { tokens } = await oauth2Client.getToken(code)
  return {
    access_token: tokens.access_token ?? '',
    refresh_token: tokens.refresh_token ?? '',
  }
}
