import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const FIRESTARTER_ORG_ID = 'd3acaf18-a924-4d25-8f5a-99b6893ae843'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (!code) {
    return NextResponse.redirect('https://sourcehq.vercel.app/dashboard/connections?error=missing_code')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: 'https://sourcehq.vercel.app/api/auth/google-agency/callback',
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await res.json()
  if (!tokens.access_token) {
    return NextResponse.redirect('https://sourcehq.vercel.app/dashboard/connections?error=token_exchange_failed')
  }

  let email = null
  try {
    const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (meRes.ok) {
      const me = await meRes.json()
      email = me.email || null
    }
  } catch {}

  const credentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + (tokens.expires_in * 1000),
    email,
  }

  const supabase = adminClient()
  await supabase.from('agency_connections').delete().eq('org_id', FIRESTARTER_ORG_ID).eq('source_type', 'google')
  await supabase.from('agency_connections').insert({
    org_id: FIRESTARTER_ORG_ID,
    source_type: 'google',
    status: 'connected',
    credentials,
  })

  return NextResponse.redirect('https://sourcehq.vercel.app/dashboard/connections?connected=google')
}