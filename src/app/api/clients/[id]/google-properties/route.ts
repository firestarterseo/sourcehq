import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth, saveGoogleSelection, getAllAgencyGoogleTokens } from '@/lib/google-auth'

const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'

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

// Enumerate GA4 properties for one account, paging through accountSummaries
// fully. accountSummaries defaults to a small page size and returns a
// nextPageToken; without paging, an account with many GA accounts silently
// drops everything past the first page (this was why a real property could be
// missing from the picker). Wrapped so a single bad/expired token throws here
// and is caught by the caller per-account, never sinking the whole response.
async function ga4PropertiesForToken(token: string, email: string): Promise<{ id: string; name: string; account: string }[]> {
  const out: { id: string; name: string; account: string }[] = []
  let pageToken: string | undefined = undefined
  let guard = 0
  do {
    const u = new URL(`${ADMIN_API}/accountSummaries`)
    u.searchParams.set('pageSize', '200')
    if (pageToken) u.searchParams.set('pageToken', pageToken)
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) break
    const json = await res.json()
    for (const acct of json.accountSummaries || []) {
      for (const prop of acct.propertySummaries || []) {
        out.push({ id: prop.property, name: prop.displayName, account: email })
      }
    }
    pageToken = json.nextPageToken || undefined
    guard++
  } while (pageToken && guard < 20)
  return out
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const auth = await getGoogleAuth(id)

  // Client has their own Google connection: use just that token (single account)
  // Agency mode: merge properties across ALL connected agency Google accounts
  let tokens: { email: string; token: string }[] = []
  if (auth.mode === 'client' && auth.token) {
    tokens = [{ email: 'client', token: auth.token }]
  } else {
    tokens = await getAllAgencyGoogleTokens()
  }

  if (tokens.length === 0) {
    return NextResponse.json({ connected: false })
  }

  const gscSites: { url: string; account: string }[] = []
  const ga4Properties: { id: string; name: string; account: string }[] = []

  for (const { email, token } of tokens) {
    // GSC sites - per-account guarded so one bad token can't break the rest.
    try {
      const gscRes = await fetch(`${GSC_API}/sites`, { headers: { Authorization: `Bearer ${token}` } })
      if (gscRes.ok) {
        const gscJson = await gscRes.json()
        for (const s of gscJson.siteEntry || []) {
          if (s.permissionLevel === 'siteUnverifiedUser') continue
          gscSites.push({ url: s.siteUrl, account: email })
        }
      }
    } catch { /* skip this account's GSC */ }

    // GA4 properties (paginated) - per-account guarded.
    try {
      const props = await ga4PropertiesForToken(token, email)
      ga4Properties.push(...props)
    } catch { /* skip this account's GA4 */ }
  }

  // De-dupe: a property visible to more than one connected account appears once.
  const seenGsc = new Set<string>()
  const dedupGsc = gscSites.filter(s => {
    if (seenGsc.has(s.url)) return false
    seenGsc.add(s.url)
    return true
  })
  const seenGa4 = new Set<string>()
  const dedupGa4 = ga4Properties.filter(p => {
    if (seenGa4.has(p.id)) return false
    seenGa4.add(p.id)
    return true
  })

  dedupGsc.sort((a, b) => a.url.localeCompare(b.url))
  dedupGa4.sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({
    connected: true,
    mode: auth.mode,
    multiAccount: tokens.length > 1,
    gscSites: dedupGsc,
    ga4Properties: dedupGa4,
    selected: {
      gsc: auth.selection.gsc_property || null,
      ga4: auth.selection.ga4_property || null,
      account: auth.selection.google_account || null,
    },
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await request.json()
  await saveGoogleSelection(id, {
    gsc_property: body.gsc_property || null,
    ga4_property: body.ga4_property || null,
    ga4_property_name: body.ga4_property_name || null,
    google_account: body.google_account || null,
  })
  return NextResponse.json({ success: true })
}
