import crypto from 'crypto'
import { ShopifyOrder } from '@/types'

export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const hash = Buffer.from(crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64'))
  const sig  = Buffer.from(signature)
  // timingSafeEqual throws on length mismatch — a malformed header must mean
  // "invalid signature" (401), not an unhandled exception (500)
  return hash.length === sig.length && crypto.timingSafeEqual(hash, sig)
}

export async function fetchShopifyOrders(
  domain: string,
  accessToken: string,
  params: { since_id?: string; created_at_min?: string; limit?: number } = {}
): Promise<ShopifyOrder[]> {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 50),
    status: 'any',
    ...(params.since_id && { since_id: params.since_id }),
    ...(params.created_at_min && { created_at_min: params.created_at_min }),
  })

  const res = await fetch(`https://${domain}/admin/api/2024-01/orders.json?${query}`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.orders as ShopifyOrder[]
}

export async function fetchShopifyOrder(
  domain: string,
  accessToken: string,
  orderId: string
): Promise<ShopifyOrder> {
  const res = await fetch(`https://${domain}/admin/api/2024-01/orders/${orderId}.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) throw new Error(`Shopify API error ${res.status}`)
  const data = await res.json()
  return data.order as ShopifyOrder
}

export async function registerWebhook(
  domain: string,
  accessToken: string,
  webhookUrl: string
): Promise<void> {
  // Use GraphQL Admin API — works without write_webhooks scope for Partners apps
  const query = `
    mutation {
      webhookSubscriptionCreate(
        topic: ORDERS_CREATE
        webhookSubscription: {
          callbackUrl: "${webhookUrl}"
          format: JSON
        }
      ) {
        webhookSubscription { id }
        userErrors { field message }
      }
    }
  `

  const res = await fetch(`https://${domain}/admin/api/2026-04/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Webhook registration failed: ${text}`)
  }

  const json = await res.json()
  const errors = json?.data?.webhookSubscriptionCreate?.userErrors ?? []
  // "already exists" is fine — just means webhook is already registered
  const realErrors = errors.filter((e: any) => !e.message?.toLowerCase().includes('already'))
  if (realErrors.length > 0) {
    throw new Error(`Webhook userErrors: ${JSON.stringify(realErrors)}`)
  }
}

export function isGiftOrSurpriseItem(item: ShopifyOrder['line_items'][0]): boolean {
  const price = parseFloat(item.price)
  const compareAtPrice = item.compare_at_price ? parseFloat(item.compare_at_price) : 0
  const isZeroPrice = price === 0
  const hadOriginalPrice = compareAtPrice > 0
  const nameHasSurprise = item.title.includes('הפתעה') || item.name.includes('הפתעה')

  const isRewardProduct = item.properties?.some(
    p => p.name === '_upcartRewardProduct' || p.name === '__upcartRewardProduct'
  )

  return (isZeroPrice && (hadOriginalPrice || isRewardProduct)) || (isZeroPrice && nameHasSurprise)
}
