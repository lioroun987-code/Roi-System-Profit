export interface FBAdInsight {
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  clicks: string
  reach: string
}

export async function fetchDailyAdSpend(
  adAccountId: string,
  accessToken: string,
  dateFrom: string,
  dateTo: string
): Promise<FBAdInsight[]> {
  const fields = 'spend,impressions,clicks,reach'
  const url = new URL(`https://graph.facebook.com/v19.0/act_${adAccountId}/insights`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('time_range', JSON.stringify({ since: dateFrom, until: dateTo }))
  url.searchParams.set('time_increment', '1')
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error?.message ?? `Facebook API error ${res.status}`)
  }

  const data = await res.json()
  return (data.data ?? []) as FBAdInsight[]
}

export async function fetchAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string; account_id: string }>> {
  const url = new URL('https://graph.facebook.com/v19.0/me/adaccounts')
  url.searchParams.set('fields', 'id,name,account_id')
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error?.message ?? `Facebook API error ${res.status}`)
  }

  const data = await res.json()
  return data.data ?? []
}
