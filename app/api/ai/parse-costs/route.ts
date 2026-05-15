import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Extract first complete JSON object from text using bracket counting
function extractJson(text: string): any | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape)               { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"')            { inString = !inString; continue }
    if (inString)              continue
    if (ch === '{')            depth++
    if (ch === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)) }
        catch { return null }
      }
    }
  }
  return null
}

const PROMPT_SCHEMA = [
  '{',
  '  "productCosts": {',
  '    "<EXACT_ID_FROM_LIST>": {',
  '      "costUsd": 8.5,',
  '      "reasoning": "short explanation in Hebrew"',
  '    }',
  '  },',
  '  "discountRules": {',
  '    "qty2Percent": 10,',
  '    "qty3Percent": 15,',
  '    "section10Percent": true,',
  '    "section15Percent": true,',
  '    "coupon50Ils": true,',
  '    "surpriseCapsuleCostUsd": 0.85,',
  '    "giftCapsuleThresholdIls": 350,',
  '    "giftCapsuleCostUsd": 0.85',
  '  },',
  '  "shippingSettings": {',
  '    "homeDeliveryCostUsd": 3,',
  '    "homeDeliveryChargeIls": 25,',
  '    "pickupFeeThresholdIls": 200,',
  '    "pickupFeeAmountIls": 10',
  '  },',
  '  "exchangeRate": 3.7,',
  '  "summary": "סיכום בעברית של מה שהבנת",',
  '  "unknownProducts": [],',
  '  "warnings": []',
  '}',
].join('\n')

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const { businessId, description, products } = await request.json()

    if (!description?.trim()) return Response.json({ error: 'תיאור ריק' }, { status: 400 })

    const business = await prisma.business.findFirst({ where: { id: businessId, userId } })
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

    const productList = (products ?? []).map((p: any) =>
      p.variants.map((v: any) =>
        `ID: ${p.id}_${v.id} | product: "${p.title}" | variant: "${v.title}" | price: ${v.price} ILS`
      ).join('\n')
    ).join('\n')

    const systemPrompt = [
      'You are a business cost configuration assistant.',
      'The user will describe their business costs and rules in Hebrew.',
      'You must return ONLY a valid JSON object — no explanation, no code fences, no extra text.',
      'Use the exact product IDs from the list provided.',
      'All numbers must be actual numbers (not placeholders).',
    ].join(' ')

    const userPrompt = [
      'Business description:',
      '"""',
      description,
      '"""',
      '',
      'Shopify products (use exact IDs):',
      productList || 'No products loaded',
      '',
      'Return ONLY this JSON structure (no extra text, no code fences):',
      PROMPT_SCHEMA,
    ].join('\n')

    let message
    try {
      message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
    } catch (e: any) {
      console.error('Anthropic API error:', e)
      return Response.json({ error: `שגיאת AI: ${e?.message ?? 'לא ידועה'}` }, { status: 500 })
    }

    const raw = (message.content[0] as any).text?.trim() ?? ''
    if (!raw) return Response.json({ error: 'AI החזיר תגובה ריקה' }, { status: 500 })

    const parsed = extractJson(raw)
    if (!parsed) {
      console.error('extractJson failed. Raw response (first 500):', raw.slice(0, 500))
      return Response.json({ error: 'AI לא החזיר JSON תקין — נסה לנסח את התיאור מחדש' }, { status: 500 })
    }

    return Response.json({ success: true, parsed })

  } catch (e: any) {
    console.error('parse-costs unhandled error:', e)
    return Response.json({ error: `שגיאת שרת: ${e?.message ?? 'לא ידועה'}` }, { status: 500 })
  }
}
