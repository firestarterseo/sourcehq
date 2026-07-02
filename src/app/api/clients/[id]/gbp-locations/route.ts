import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth, saveGoogleSelection, getAllAgencyGoogleTokens } from '@/lib/google-auth'

const ACCT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1'
const INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1'

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

async function locationsForToken(token: string, email: string): Promise<{ id: string; name: string; account: string }[]> {
  const out: { id: string; name: string; account: string }[] = []
  const acctRes = await fetch(`${ACCT_API}/accounts`, { headers: { Authorization: `Bearer ${token}` } })
  if (!acctRes.ok) return out
  const acctJson = await acctRes.json()
  for (const acct of acctJson.accounts || []) {
    const locRes = await fetch(`${INFO_API}/${acct.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`, { headers: { Authorization: `Bearer ${token}` } })
    if (!locRes.ok) continue
    const locJson = await locRes.json()
    for (const loc of locJson.locations || []) {
      const addr = loc.storefrontAddress
      const cityState = addr ? `${addr.locality || ''}${addr.administrativeArea ? ', ' + addr.administrativeArea : ''}` : ''
      out.push({ id: loc.name, name: `${loc.title || loc.name}${cityState ? ' — ' + cityState : ''}`, account: email })
    }
  }
  return out
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const auth = await getGoogleAuth(id, 'gbp')

  let tokens: { email: string; token: string }[] = []
  if (auth.mode === 'client' && auth.token) {
    tokens = [{ email: 'client', token: auth.token }]
  } else {
    tokens = await getAllAgencyGoogleTokens()
  }

  if (tokens.length === 0) {
    return NextResponse.json({ connected: false })
  }

  const locations: { id: string; name: string; account: string }[] = []
  let anyPending = false
  let lastError = ''

  for (const { email, token } of tokens) {
    try {
      const found = await locationsForToken(token, email)
      locations.push(...found)
    } catch (err: any) {
      lastError = err.message || 'GBP lookup failed'
    }
  }

  // If we found nothing at all, surface a pending/error state the same way
  // the single-account version used to, so the UI message stays accurate.
  if (locations.length === 0) {
    return NextResponse.json({
      connected: true,
      available: false,
      pending: true,
      error: lastError || 'Business Profile API access not active yet, or no locations found on connected accounts.',
    })
  }

  const seen = new Set<string>()
  const dedup = locations.filter(l => {
    if (seen.has(l.id)) return false
    seen.add(l.id)
    return true
  })
  dedup.sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({
    connected: true,
    available: true,
    multiAccount: tokens.length > 1,
    locations: dedup,
    selected: auth.selection.gbp_location || null,
    selectedAccount: auth.selection.gbp_google_account || auth.selection.google_account || null,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let gbp_location: string | null = null
  let gbp_location_name: string | null = null
  let gbp_google_account: string | null = null
  try {
    const body = await request.json()
    gbp_location = body?.gbp_location ?? null
    gbp_location_name = body?.gbp_location_name ?? null
    gbp_google_account = body?.gbp_google_account ?? null
  } catch {}
  await saveGoogleSelection(id, { gbp_location, gbp_location_name, gbp_google_account })
  return NextResponse.json({ success: true })
}
