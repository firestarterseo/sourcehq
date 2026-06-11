import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'
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
    throw new Error('Failed to refresh token')
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

async function getConnection(clientId: string) {
  const { data } = await adminClient()
    .from('data_connections')
    .select('credentials, status')
    .eq('client_id', clientId)
    .eq('source_type', 'google')
    .single()
  return data
}

// GET: list all GSC sites and GA4 properties the connected account can see
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const connection = await getConnection(id)
  if (!connection || connection.status !== 'connected') {
    return NextResponse.json({ connected: false })
  }

  try {
    const token = await refreshTokenIfNeeded(connection.credentials, id)

    // GSC sites
    const gscRes = await fetch(`${GSC_API}/sites`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const gscJson = gscRes.ok ? await gscRes.json() : { siteEntry: [] }
    const gscSites = (gscJson.siteEntry || [])
      .filter((s: any) => s.permissionLevel !== 'siteUnverifiedUser')
      .map((s: any) => s.siteUrl)
      .sort()

    // GA4 properties
    const ga4Res = await fetch(`${ADMIN_API}/accountSummaries?pageSize=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const ga4Json = ga4Res.ok ? await ga4Res.json() : { accountSummaries: [] }
    const ga4Properties: { id: string; name: string }[] = []
    for (const account of ga4Json.accountSummaries || []) {
      for (const p of account.propertySummaries || []) {
        ga4Properties.push({ id: p.property, name: p.displayName })
      }
    }
    ga4Properties.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      connected: true,
      gscSites,
      ga4Properties,
      selected: {
        gsc: connection.credentials.gsc_property || null,
        ga4: connection.credentials.ga4_property || null,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}

// POST: save the chosen properties for this client
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const connection = await getConnection(id)
  if (!connection || connection.status !== 'connected') {
    return NextResponse.json({ connected: false })
  }

  const body = await request.json()
  const { gsc_property, ga4_property, ga4_property_name } = body

  const newCredentials = {
    ...connection.credentials,
    gsc_property: gsc_property ?? connection.credentials.gsc_property ?? null,
    ga4_property: ga4_property ?? connection.credentials.ga4_property ?? null,
    ga4_property_name: ga4_property_name ?? connection.credentials.ga4_property_name ?? null,
  }

  const { error } = await adminClient()
    .from('data_connections')
    .update({ credentials: newCredentials })
    .eq('client_id', id)
    .eq('source_type', 'google')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}