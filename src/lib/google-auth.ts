import { createClient } from '@supabase/supabase-js'

const FIRESTARTER_ORG_ID = 'd3acaf18-a924-4d25-8f5a-99b6893ae843'

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  return res.json()
}

export interface GoogleAuth {
  token: string | null
  mode: 'client' | 'agency' | 'none'
  revoked?: boolean
  // per-client selections (stored on the client's data_connections row)
  selection: {
    gsc_property: string | null
    ga4_property: string | null
    ga4_property_name: string | null
      gbp_location: string | null
      gbp_location_name: string | null
      google_account: string | null
  }
}

/**
 * Resolve a working Google access token for a client.
 * Priority: client's own connection -> agency connection -> none.
 * Property selections always come from the client's row.
 */
export async function getGoogleAuth(clientId: string): Promise<GoogleAuth> {
  const supabase = adminClient()

  const { data: clientConn } = await supabase
    .from('data_connections')
    .select('credentials, status')
    .eq('client_id', clientId)
    .eq('source_type', 'google')
    .single()

  const selection = {
    gsc_property: clientConn?.credentials?.gsc_property ?? null,
    ga4_property: clientConn?.credentials?.ga4_property ?? null,
    ga4_property_name: clientConn?.credentials?.ga4_property_name ?? null,
      gbp_location: clientConn?.credentials?.gbp_location ?? null,
      gbp_location_name: clientConn?.credentials?.gbp_location_name ?? null,
      google_account: clientConn?.credentials?.google_account ?? null,
  }

  // Mode 1: client has their own working Google connection
  if (clientConn && clientConn.status === 'connected' && clientConn.credentials?.refresh_token) {
    const creds = clientConn.credentials
    if (Date.now() < creds.expires_at - 60000) {
      return { token: creds.access_token, mode: 'client', selection }
    }
    const tokens = await refreshGoogleToken(creds.refresh_token)
    if (tokens.access_token) {
      await supabase
        .from('data_connections')
        .update({
          credentials: {
            ...creds,
            access_token: tokens.access_token,
            expires_at: Date.now() + tokens.expires_in * 1000,
          },
        })
        .eq('client_id', clientId)
        .eq('source_type', 'google')
      return { token: tokens.access_token, mode: 'client', selection }
    }
    if (tokens.error === 'invalid_grant') {
      await supabase
        .from('data_connections')
        .update({ status: 'disconnected' })
        .eq('client_id', clientId)
        .eq('source_type', 'google')
      // fall through to agency
    }
  }

  // Mode 2: agency connection (account-aware, multi-account)
  const { data: agencyRows } = await supabase
    .from('agency_connections')
    .select('credentials, status, account_email')
    .eq('org_id', FIRESTARTER_ORG_ID)
    .eq('source_type', 'google')

  const connected = (agencyRows || []).filter((r: any) => r.status === 'connected' && r.credentials?.refresh_token)
  if (connected.length > 0) {
    // Pick the account this client's selection is tagged to; fall back to the first connected account
    const wanted = selection.google_account
    const chosen = (wanted && connected.find((r: any) => r.account_email === wanted)) || connected[0]
    const creds: any = chosen.credentials

    if (Date.now() < creds.expires_at - 60000) {
      return { token: creds.access_token, mode: 'agency', selection }
    }
    const tokens = await refreshGoogleToken(creds.refresh_token)
    if (tokens.access_token) {
      await supabase
        .from('agency_connections')
        .update({
          credentials: { ...creds, access_token: tokens.access_token, expires_at: Date.now() + tokens.expires_in * 1000 },
        })
        .eq('org_id', FIRESTARTER_ORG_ID)
        .eq('source_type', 'google')
        .eq('account_email', chosen.account_email)
      return { token: tokens.access_token, mode: 'agency', selection }
    }
    if (tokens.error === 'invalid_grant') {
      await supabase
        .from('agency_connections')
        .update({ status: 'disconnected' })
        .eq('org_id', FIRESTARTER_ORG_ID)
        .eq('source_type', 'google')
        .eq('account_email', chosen.account_email)
      return { token: null, mode: 'none', revoked: true, selection }
    }
  }

  return { token: null, mode: 'none', selection }
}

/** Save per-client property selections (works in agency or client mode). */
export async function saveGoogleSelection(
  clientId: string,
  patch: { gsc_property?: string | null; ga4_property?: string | null; ga4_property_name?: string | null; gbp_location?: string | null; gbp_location_name?: string | null; google_account?: string | null }
) {
  const supabase = adminClient()
  const { data: existing } = await supabase
    .from('data_connections')
    .select('credentials, status')
    .eq('client_id', clientId)
    .eq('source_type', 'google')
    .single()

  if (existing) {
    await supabase
      .from('data_connections')
      .update({ credentials: { ...existing.credentials, ...patch } })
      .eq('client_id', clientId)
      .eq('source_type', 'google')
  } else {
    await supabase.from('data_connections').insert({
      client_id: clientId,
      source_type: 'google',
      status: 'connected',
      credentials: { mode: 'agency', ...patch },
    })
  }
}

export async function getAgencyGoogleStatus() {
  const supabase = adminClient()
  const { data } = await supabase
    .from('agency_connections')
    .select('credentials, status, account_email')
    .eq('org_id', FIRESTARTER_ORG_ID)
    .eq('source_type', 'google')
  const rows = data || []
  const accounts = rows
    .filter((r: any) => r.status === 'connected')
    .map((r: any) => ({ email: r.account_email || r.credentials?.email || 'Unknown account' }))
  return {
    connected: accounts.length > 0,
    email: accounts[0]?.email || null,
    accounts,
  }
}





export async function getAllAgencyGoogleTokens(): Promise<{ email: string; token: string }[]> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('agency_connections')
    .select('credentials, status, account_email')
    .eq('org_id', FIRESTARTER_ORG_ID)
    .eq('source_type', 'google')
  const out: { email: string; token: string }[] = []
  for (const row of (data || [])) {
    if (row.status !== 'connected') continue
    const creds: any = row.credentials
    if (!creds?.refresh_token) continue
    const email = row.account_email || creds.email || 'unknown'
    if (Date.now() < creds.expires_at - 60000 && creds.access_token) {
      out.push({ email, token: creds.access_token })
      continue
    }
    const tokens = await refreshGoogleToken(creds.refresh_token)
    if (tokens.access_token) {
      await supabase
        .from('agency_connections')
        .update({ credentials: { ...creds, access_token: tokens.access_token, expires_at: Date.now() + tokens.expires_in * 1000 } })
        .eq('org_id', FIRESTARTER_ORG_ID)
        .eq('source_type', 'google')
        .eq('account_email', row.account_email)
      out.push({ email, token: tokens.access_token })
    }
  }
  return out
}

