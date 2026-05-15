import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
      `ID: ${p.id}_${v.id} | מוצר: "${p.title}" | וריאנט: "${v.title}" | מחיר מכירה: ₪${v.price}`
    ).join('\n')
  ).join('\n')

  const prompt = `אתה עוזר לבעל עסק להגדיר את מערכת הרווחיות שלו.

בעל העסק תיאר את העסק שלו בחופשיות:
"""
${description}
"""

אלו המוצרים שלו בשופיפיי (עם ה-ID המדויק של כל וריאנט):
${productList || 'לא נטענו מוצרים'}

המשימה שלך:
1. לפרש את התיאור ולהתאים עלות לכל מוצר/וריאנט לפי שם
2. לחלץ כללי הנחות
3. לחלץ הגדרות משלוח

החזר ONLY JSON תקין בפורמט הזה:
{
  "productCosts": {
    "<ID המדויק מהרשימה>": {
      "costUsd": <מספר — עלות בדולרים>,
      "reasoning": "<משפט קצר למה בחרת עלות זו>"
    }
  },
  "discountRules": {
    "qty2Percent": <מספר>,
    "qty3Percent": <מספר>,
    "section10Percent": <boolean>,
    "section15Percent": <boolean>,
    "coupon50Ils": <boolean>,
    "surpriseCapsuleCostUsd": <מספר>,
    "giftCapsuleThresholdIls": <מספר>,
    "giftCapsuleCostUsd": <מספר>
  },
  "shippingSettings": {
    "homeDeliveryCostUsd": <מספר>,
    "homeDeliveryChargeIls": <מספר>,
    "pickupFeeThresholdIls": <מספר>,
    "pickupFeeAmountIls": <מספר>
  },
  "exchangeRate": <מספר — אם הוזכר, אחרת 3.7>,
  "summary": "<סיכום בעברית של מה שהבנת — כל מוצר עם העלות שלו, הכללים, המשלוח>",
  "unknownProducts": ["<שמות מוצרים שלא הצלחת לתאם עלות>"],
  "warnings": ["<אזהרות אם יש — למשל: לא הוזכרה עלות למוצר X>"]
}`

  let message
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (e: any) {
    console.error('Anthropic API error:', e)
    return Response.json({ error: `שגיאת AI: ${e?.message ?? 'לא ידועה'}` }, { status: 500 })
  }

  const text = (message.content[0] as any).text?.trim() ?? ''
  if (!text) return Response.json({ error: 'AI החזיר תגובה ריקה' }, { status: 500 })

  // Robust JSON extraction: find first { then count brackets to find matching }
  const parsed = extractJson(text)
  if (!parsed) {
    console.error('Could not extract JSON from AI response. First 400 chars:', text.slice(0, 400))
    return Response.json({ error: 'AI לא החזיר JSON תקין — נסה לנסח את התיאור מחדש' }, { status: 500 })
  }

  return Response.json({ success: true, parsed })
  } catch (e: any) {
    console.error('parse-costs unhandled error:', e)
    return Response.json({ error: `שגיאת שרת: ${e?.message ?? 'לא ידועה'}` }, { status: 500 })
  }
}
