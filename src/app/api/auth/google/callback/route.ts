import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://sourcehq.vercel.app'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') || ''
  const sep = state.indexOf('|')
  const clientId = sep === -1 ? state : state.slice(0, sep)
  const next = sep === -1 ? '' : state.slice(sep + 1)
  const dest = next || `/dashboard/clients/${clientId}`
  const error = searchParams.get('error')
  if (error || !code || !clientId) {
    return NextResponse.redirect(`${BASE_URL}${dest}?error=google_auth_failed`)
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${BASE_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      throw new Error(`No access token received: ${JSON.stringify(tokens)}`)
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // MERGE the new OAuth tokens into any existing credentials for this client
    // instead of overwriting the whole row. The pre-existing credentials may
    // already carry gsc_property, ga4_property, ga4_property_name,
    // gbp_location, gbp_location_name, google_account, gbp_google_account -
    // property selections the user made through the agency-pool picker - and
    // a blind upsert (write-shape overwrite) blows those away, silently
    // undoing setup work every time someone reconnects. Read-then-merge
    // preserves selections while updating only the token fields.
    const { data: existing } = await adminSupabase
      .from('data_connections')
      .select('credentials')
      .eq('client_id', clientId)
      .eq('source_type', 'google')
      .single()

    const merged = {
      ...(existing?.credentials || {}),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
    }

    const { error: upsertError } = await adminSupabase
      .from('data_connections')
      .upsert({
        client_id: clientId,
        source_type: 'google',
        status: 'connected',
        credentials: merged,
        last_synced: new Date().toISOString(),
      }, { onConflict: 'client_id,source_type' })

    if (upsertError) throw upsertError

    return NextResponse.redirect(`${BASE_URL}${dest}?connected=google`)
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(`${BASE_URL}${dest}?error=token_exchange_failed`)
  }
}
