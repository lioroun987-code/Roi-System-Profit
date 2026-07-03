import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import { getGoogleAuthClient } from '@/lib/sheets'
import { analyzeOrder } from '@/lib/claude'
import { calculateOrderCost } from '@/lib/calculator'
import { BusinessConfig, ShopifyOrder } from '@/types'

// Sheet layout (1-based): order number is in column I, my cost goes in column G.
// Rows are added by an external Make automation with column G left empty; we only
// fill that empty cell and never overwrite a row that already has a cost.
const COL_ORDER_NUMBER = 9   // I — order number written by Make
const COL_MY_COST      = 7   // G — my cost (target)

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { businessId } = await request.json()

  const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

  if (!business.googleRefreshToken || !business.googleSheetsId) {
    return Response.json({ error: 'Google Sheets לא מחובר' }, { status: 400 })
  }
  if (!business.shopifyDomain || !business.shopifyAccessToken) {
    return Response.json({ error: 'Shopify לא מחובר' }, { status: 400 })
  }

  const auth = getGoogleAuthClient(business.googleRefreshToken)
  const sheets = google.sheets({ version: 'v4', auth })

  // Read A..I so column indices are absolute and column I (order number) is
  // included. Unbounded so orders past row 1000 aren't silently skipped.
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: business.googleSheetsId,
    range: 'A2:I',
  })

  const rows = readRes.data.values ?? []
  if (rows.length === 0) return Response.json({ processed: 0, message: 'הגיליון ריק' })

  const config: BusinessConfig = {
    productCosts: business.productCosts as any,
    discountRules: business.discountRules as any,
    paymentSettings: business.paymentSettings as any,
    aiNotes: business.aiNotes ?? '',
  }

  let processed = 0
  let skipped = 0
  let errors = 0
  const updates: { range: string; values: string[][] }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNumber = i + 2 // +2 because we start from row 2

    const orderNumberRaw = row[COL_ORDER_NUMBER - 1]?.toString().trim()
    if (!orderNumberRaw) { skipped++; continue }

    // Skip if cost already filled
    const existingCost = row[COL_MY_COST - 1]?.toString().trim()
    if (existingCost && existingCost !== '' && existingCost !== '0') { skipped++; continue }

    // Extract numeric order number (remove # if present)
    const orderNumber = orderNumberRaw.replace('#', '').trim()

    try {
      // 1. Check our DB first
      let shopifyOrder: ShopifyOrder | null = null
      const dbOrder = await prisma.order.findFirst({
        where: { businessId, orderNumber },
      })

      if (dbOrder?.aiAnalysis) {
        // Already analyzed — use cached result. Write cost into column G only.
        const analysis = dbOrder.aiAnalysis as any
        updates.push({
          range: `G${rowNumber}`,
          values: [[analysis.my_cost_ils?.toFixed(2) ?? '']],
        })
        processed++
        continue
      }

      // 2. Fetch from Shopify by order number
      // Search by order name (#1234)
      const searchRes = await fetch(
        `https://${business.shopifyDomain}/admin/api/2024-01/orders.json?name=${encodeURIComponent('#' + orderNumber)}&status=any`,
        { headers: { 'X-Shopify-Access-Token': business.shopifyAccessToken } }
      )

      if (!searchRes.ok) { errors++; continue }
      const searchData = await searchRes.json()
      shopifyOrder = searchData.orders?.[0] ?? null

      if (!shopifyOrder) {
        // Try without #
        const searchRes2 = await fetch(
          `https://${business.shopifyDomain}/admin/api/2024-01/orders.json?name=${encodeURIComponent(orderNumber)}&status=any`,
          { headers: { 'X-Shopify-Access-Token': business.shopifyAccessToken } }
        )
        const data2 = await searchRes2.json()
        shopifyOrder = data2.orders?.[0] ?? null
      }

      if (!shopifyOrder) { errors++; continue }

      // 3. Try deterministic calculator first, fall back to AI for unknowns
      const analysis = calculateOrderCost(shopifyOrder, config) ?? await analyzeOrder(shopifyOrder, config)

      // 4. Save to our DB
      await prisma.order.upsert({
        where: { businessId_shopifyOrderId: { businessId, shopifyOrderId: String(shopifyOrder.id) } },
        create: {
          businessId,
          shopifyOrderId: String(shopifyOrder.id),
          orderNumber: String(shopifyOrder.order_number),
          orderDate: new Date(shopifyOrder.created_at),
          customerName: shopifyOrder.customer ? `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`.trim() : null,
          rawData: shopifyOrder as any,
          aiAnalysis: analysis as any,
          orderSummary: analysis.order_summary,
          storePrice: analysis.store_price_breakdown.total,
          myCostUsd: analysis.my_cost_breakdown.total_usd,
          myCostIls: analysis.my_cost_ils,
          grossProfitIls: analysis.gross_profit_ils,
          paymentFeeIls: analysis.payment_fee_ils,
          vatIls: analysis.vat_ils,
          netProfitIls: analysis.net_profit_ils,
          netProfitUsd: analysis.net_profit_usd,
          paymentMethod: analysis.payment_method,
          status: 'analyzed',
        },
        update: {
          aiAnalysis: analysis as any,
          myCostIls: analysis.my_cost_ils,
          netProfitIls: analysis.net_profit_ils,
          status: 'analyzed',
        },
      })

      // 5. Queue sheet update — cost into column G only
      updates.push({
        range: `G${rowNumber}`,
        values: [[analysis.my_cost_ils.toFixed(2)]],
      })

      processed++
    } catch (err) {
      console.error(`Error processing row ${rowNumber} (order ${orderNumber}):`, err)
      errors++
    }
  }

  // 6. Write all updates back to sheet in batch
  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: business.googleSheetsId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates.map(u => ({ range: u.range, values: u.values })),
      },
    })
  }

  return Response.json({
    processed,
    skipped,
    errors,
    message: `עודכנו ${processed} שורות, ${skipped} דולגו, ${errors} שגיאות`,
  })
}
