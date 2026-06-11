import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth, saveGoogleSelection } from '@/lib/google-auth'

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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const auth = await getGoogleAuth(id)
  if (!auth.token) {
    return NextResponse.json({ connected: false })
  }

  try {
    const gscRes = await fetch(`${GSC_API}/sites`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    const gscJson = gscRes.ok ? await gscRes.json() : { siteEntry: [] }
    const gscSites = (gscJson.siteEntry || [])
      .filter((s: any) => s.permissionLevel !== 'siteUnverifiedUser')
      .map((s: any) => s.siteUrl)
      .sort()

    const ga4Res = await fetch(`${ADMIN_API}/accountSummaries?pageSize=200`, {
      headers: { Authorization: `Bearer ${auth.token}` },
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
      mode: auth.mode,
      gscSites,
      ga4Properties,
      selected: {
        gsc: auth.selection.gsc_property,
        ga4: auth.selection.ga4_property,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  await saveGoogleSelection(id, {
    gsc_property: body.gsc_property ?? null,
    ga4_property: body.ga4_property ?? null,
    ga4_property_name: body.ga4_property_name ?? null,
  })

  return NextResponse.json({ success: true })
}