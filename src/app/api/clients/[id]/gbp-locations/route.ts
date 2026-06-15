import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth, saveGoogleSelection } from '@/lib/google-auth'

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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const auth = await getGoogleAuth(id)
  if (!auth.token) return NextResponse.json({ connected: false })

  try {
    const acctRes = await fetch(`${ACCT_API}/accounts`, { headers: { Authorization: `Bearer ${auth.token}` } })
    const acctJson = await acctRes.json()
    if (!acctRes.ok) {
      const msg = acctJson?.error?.message || `GBP ${acctRes.status}`
      const pending = acctRes.status === 403 || /not been used|disabled|accessNotConfigured|SERVICE_DISABLED|permission/i.test(msg)
      return NextResponse.json({ connected: true, available: false, pending, error: pending ? 'Business Profile API access not active yet.' : msg })
    }

    const accounts = acctJson.accounts || []
    const locations: { id: string; name: string; account: string }[] = []
    for (const acct of accounts) {
      const locRes = await fetch(`${INFO_API}/${acct.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`, { headers: { Authorization: `Bearer ${auth.token}` } })
      if (!locRes.ok) continue
      const locJson = await locRes.json()
      for (const loc of locJson.locations || []) {
        const addr = loc.storefrontAddress
        const cityState = addr ? `${addr.locality || ''}${addr.administrativeArea ? ', ' + addr.administrativeArea : ''}` : ''
        locations.push({ id: loc.name, name: `${loc.title || loc.name}${cityState ? ' — ' + cityState : ''}`, account: acct.name })
      }
    }

    return NextResponse.json({ connected: true, available: true, locations, selected: auth.selection.gbp_location || null })
  } catch (err: any) {
    return NextResponse.json({ connected: true, available: false, error: err.message })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let gbp_location: string | null = null
  let gbp_location_name: string | null = null
  try {
    const body = await request.json()
    gbp_location = body?.gbp_location ?? null
    gbp_location_name = body?.gbp_location_name ?? null
  } catch {}

  await saveGoogleSelection(id, { gbp_location, gbp_location_name })
  return NextResponse.json({ success: true })
}
