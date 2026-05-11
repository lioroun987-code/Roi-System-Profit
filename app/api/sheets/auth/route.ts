import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOAuthUrl } from '@/lib/sheets'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) return Response.json({ error: 'businessId required' }, { status: 400 })

  const authUrl = getOAuthUrl()
  const urlWithState = authUrl + `&state=${businessId}`
  redirect(urlWithState)
}
