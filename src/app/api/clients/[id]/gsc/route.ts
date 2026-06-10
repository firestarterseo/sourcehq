// Save as: app/api/clients/[id]/gsc/route.ts (replaces existing contents)
// Merged: keeps your data_connections/credentials schema and session auth,
// adds error checks, property-format resolution, 2-day lag offset,
// invalid_grant handling, parallel queries, daily trend + top pages.

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'

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
    // User revoked access in their Google account — flip the connection
    // to disconnected so the UI shows "Reconnect" instead of erroring forever
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

async function gscQuery(token: string, property: string, body: Record<string, unknown>) {
  const res = await fetch(
    `${GSC_API}/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  const json = await res.json()
  if (!res.ok) {
    const err: any = new Error(json?.error?.message ?? `GSC ${res.status}`)
    err.status = res.status
    throw err
  }
  return json
}

// clients.website may not match the GSC property format exactly
// (trailing slash, http vs https, or a domain property). Ask GSC which
// properties this account can actually see and pick the best match.
async function resolveProperty(token: string, website: string): Promise<string | null> {
  const res = await fetch(`${GSC_API}/sites`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null

  const { siteEntry } = await res.json()
  if (!siteEntry?.length) return null

  const usable = siteEntry.filter(
    (s: any) => s.permissionLevel !== 'siteUnverifiedUser'
  )

  const hostname = website
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .toLowerCase()

  // Prefer domain property, then URL-prefix containing the hostname
  const domainMatch = usable.find(
    (s: any) => s.siteUrl === `sc-domain:${hostname}`
  )
  if (domainMatch) return domainMatch.siteUrl

  const prefixMatch = usable.find((s: any) =>
    s.siteUrl.toLowerCase().includes(hostname)
  )
  return prefixMatch?.siteUrl ?? null
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

    const property = await resolveProperty(accessToken, client.website)
    if (!property) {
      return NextResponse.json({
        connected: true,
        error: `No Search Console property found matching ${client.website} on the connected Google account`,
      })
    }

    // GSC data lags ~2 days; end the window there to avoid trailing zeros
    const end = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
    const startDate = start.toISOString().split('T')[0]
    const endDate = end.toISOString().split('T')[0]
    const range = { startDate, endDate }

    const [daily, queries, pages] = await Promise.all([
      gscQuery(accessToken, property, { ...range, dimensions: ['date'], rowLimit: 31 }),
      gscQuery(accessToken, property, { ...range, dimensions: ['query'], rowLimit: 10 }),
      gscQuery(accessToken, property, { ...range, dimensions: ['page'], rowLimit: 10 }),
    ])

    const totals = (daily.rows || []).reduce(
      (acc: any, row: any) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
      }),
      { clicks: 0, impressions: 0 }
    )

    const avgCtr = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(1) : '0'
    const avgPosition = daily.rows?.length > 0
      ? (daily.rows.reduce((acc: number, row: any) => acc + row.position, 0) / daily.rows.length).toFixed(1)
      : '0'

    return NextResponse.json({
      connected: true,
      property,
      summary: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: avgCtr,
        position: avgPosition,
        period: 'Last 28 days',
      },
      daily: (daily.rows || []).map((row: any) => ({
        date: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
      })),
      topQueries: (queries.rows || []).map((row: any) => ({
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: (row.ctr * 100).toFixed(1),
        position: row.position.toFixed(1),
      })),
      topPages: (pages.rows || []).map((row: any) => ({
        page: row.keys[0].replace(/^https?:\/\/[^/]+/, '') || '/',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: (row.ctr * 100).toFixed(1),
        position: row.position.toFixed(1),
      })),
    })
  } catch (err: any) {
    if (err.message === 'REVOKED') {
      return NextResponse.json({ connected: false, revoked: true })
    }
    if (err.status === 403) {
      return NextResponse.json({
        connected: true,
        error: 'The connected Google account does not have access to this Search Console property',
      })
    }
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}