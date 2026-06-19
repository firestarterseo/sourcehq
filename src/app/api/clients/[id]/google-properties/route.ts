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

  try {
    const gscSites: { url: string; account: string }[] = []
    const ga4Properties: { id: string; name: string; account: string }[] = []

    for (const { email, token } of tokens) {
      // GSC sites for this account.
      const gscRes = await fetch(`${GSC_API}/sites`, { headers: { Authorization: `Bearer ${token}` } })
      if (gscRes.ok) {
        const gscJson = await gscRes.json()
        for (const s of gscJson.siteEntry || []) {
          if (s.permissionLevel === 'siteUnverifiedUser') continue
          gscSites.push({ url: s.siteUrl, account: email })
        }
      }

      // GA4 accountSummaries is PAGINATED (returns nextPageToken). Without
      // paging, an account with many GA accounts silently drops everything past
      // the first page - which is why a real property could be missing from the
      // picker. Page through fully.
      let pageToken: string | undefined = undefined
      let guard = 0
      do {
        const u = new URL(`${ADMIN_API}/accountSummaries`)
        u.searchParams.set('pageSize', '200')
        if (pageToken) u.searchParams.set('pageToken', pageToken)
        const ga4Res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } })
        if (!ga4Res.ok) break
        const ga4Json = await ga4Res.json()
        for (const acct of ga4Json.accountSummaries || []) {
          for (const prop of acct.propertySummaries || []) {
            ga4Properties.push({ id: prop.property, name: prop.displayName, account: email })
          }
        }
        pageToken = ga4Json.nextPageToken || undefined
        guard++
      } while (pageToken && guard < 20)
    }

    // De-dupe: a property visible to more than one connected account should
    // appear once.
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
  } catch (err: any) {
    return NextResponse.json({ connected: true, error: err.message, gscSites: [], ga4Properties: [] })
  }
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
