import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'

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

  if (!tokens.access_token) {
    if (tokens.error === 'invalid_grant') {
      await adminClient()
        .from('data_connections')
        .update({ status: 'disconnected' })
        .eq('client_id', clientId)
        .eq('source_type', 'google')
      throw new Error('REVOKED')
    }
    throw new Error(`Failed to refresh token: ${tokens.error ?? 'unknown'}`)
  }

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

function extractHostname(url: string) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .toLowerCase()
}

// Find which GA4 property belongs to this client's website.
// Prefers an EXACT hostname match (firestarterseo.com), and only
// falls back to a partial match (offers.firestarterseo.com) if
// no exact match exists.
async function resolveGa4Property(token: string, website: string) {
  const res = await fetch(`${ADMIN_API}/accountSummaries?pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null

  const json = await res.json()
  const properties: { property: string; displayName: string }[] = []
  for (const account of json.accountSummaries || []) {
    for (const p of account.propertySummaries || []) {
      properties.push({ property: p.property, displayName: p.displayName })
    }
  }
  if (properties.length === 0) return null

  const targetHost = extractHostname(website)
  let partialMatch: { property: string; displayName: string } | null = null

  for (const p of properties.slice(0, 50)) {
    const streamsRes = await fetch(`${ADMIN_API}/${p.property}/dataStreams`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!streamsRes.ok) continue
    const streams = await streamsRes.json()
    for (const s of streams.dataStreams || []) {
      const streamUri = s.webStreamData?.defaultUri || ''
      if (!streamUri) continue
      const streamHost = extractHostname(streamUri)
      if (streamHost === targetHost) {
        return p // exact match — done
      }
      if (!partialMatch && streamHost.includes(targetHost)) {
        partialMatch = p // remember as backup, keep looking for exact
      }
    }
  }

  return partialMatch
}

async function runReport(token: string, property: string, body: Record<string, unknown>) {
  const res = await fetch(`${DATA_API}/${property}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    const err: any = new Error(json?.error?.message ?? `GA4 ${res.status}`)
    err.status = res.status
    throw err
  }
  return json
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

    const property = await resolveGa4Property(accessToken, client.website)
    if (!property) {
      return NextResponse.json({
        connected: true,
        error: `No Google Analytics property found matching ${client.website} on the connected Google account`,
      })
    }

    const dateRanges = [{ startDate: '28daysAgo', endDate: 'yesterday' }]

    const [totalsReport, dailyReport, pagesReport, channelsReport] = await Promise.all([
      runReport(accessToken, property.property, {
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
      }),
      runReport(accessToken, property.property, {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 31,
      }),
      runReport(accessToken, property.property, {
        dateRanges,
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      runReport(accessToken, property.property, {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
    ])

    const totalsRow = totalsReport.rows?.[0]?.metricValues || []

    return NextResponse.json({
      connected: true,
      propertyName: property.displayName,
      summary: {
        sessions: Number(totalsRow[0]?.value || 0),
        users: Number(totalsRow[1]?.value || 0),
        pageviews: Number(totalsRow[2]?.value || 0),
        period: 'Last 28 days',
      },
      daily: (dailyReport.rows || []).map((row: any) => ({
        date: `${row.dimensionValues[0].value.slice(0, 4)}-${row.dimensionValues[0].value.slice(4, 6)}-${row.dimensionValues[0].value.slice(6, 8)}`,
        sessions: Number(row.metricValues[0].value),
      })),
      topPages: (pagesReport.rows || []).map((row: any) => ({
        page: row.dimensionValues[0].value || '/',
        sessions: Number(row.metricValues[0].value),
      })),
      channels: (channelsReport.rows || []).map((row: any) => ({
        channel: row.dimensionValues[0].value,
        sessions: Number(row.metricValues[0].value),
      })),
    })
  } catch (err: any) {
    if (err.message === 'REVOKED') {
      return NextResponse.json({ connected: false, revoked: true })
    }
    if (err.status === 403) {
      return NextResponse.json({
        connected: true,
        error: 'The connected Google account does not have access to this Analytics property',
      })
    }
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}