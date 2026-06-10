import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
  return supabase.auth.getSession()
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function refreshTokenIfNeeded(credentials: any, clientId: string) {
  if (Date.now() < credentials.expires_at - 60000) {
    return credentials.access_token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: credentials.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await res.json()
  if (!tokens.access_token) throw new Error('Failed to refresh token')

  const newCredentials = {
    ...credentials,
    access_token: tokens.access_token,
    expires_at: Date.now() + (tokens.expires_in * 1000),
  }

  await adminClient()
    .from('data_connections')
    .update({ credentials: newCredentials })
    .eq('client_id', clientId)
    .eq('source_type', 'google')

  return tokens.access_token
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: connection } = await adminClient()
    .from('data_connections')
    .select('credentials, status')
    .eq('client_id', id)
    .eq('source_type', 'google')
    .single()

  if (!connection || connection.status !== 'connected') {
    return NextResponse.json({ connected: false })
  }

  try {
    const accessToken = await refreshTokenIfNeeded(connection.credentials, id)

    const { data: client } = await adminClient()
      .from('clients')
      .select('website')
      .eq('id', id)
      .single()

    if (!client?.website) {
      return NextResponse.json({ connected: true, error: 'No website set for this client' })
    }

    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const gscRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(client.website)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['query'],
          rowLimit: 10,
        }),
      }
    )

    const gscData = await gscRes.json()

    const summaryRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(client.website)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['date'],
        }),
      }
    )

    const summaryData = await summaryRes.json()

    const totals = (summaryData.rows || []).reduce(
      (acc: any, row: any) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
      }),
      { clicks: 0, impressions: 0 }
    )

    const avgCtr = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(1) : '0'
    const avgPosition = summaryData.rows?.length > 0
      ? (summaryData.rows.reduce((acc: number, row: any) => acc + row.position, 0) / summaryData.rows.length).toFixed(1)
      : '0'

    return NextResponse.json({
      connected: true,
      summary: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: avgCtr,
        position: avgPosition,
        period: `Last 28 days`,
      },
      topQueries: (gscData.rows || []).slice(0, 10).map((row: any) => ({
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: (row.ctr * 100).toFixed(1),
        position: row.position.toFixed(1),
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}
