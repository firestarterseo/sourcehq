import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth } from '@/lib/google-auth'

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = [28, 90, 180, 365, 730].includes(daysParam) ? daysParam : 28
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const auth = await getGoogleAuth(id)
  if (!auth.token) {
    return NextResponse.json({ connected: false, revoked: auth.revoked || false })
  }

  const property = auth.selection.gsc_property
  if (!property) {
    return NextResponse.json({ connected: true, needsSelection: true })
  }

  try {
    const end = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    const range = {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    }

    const [daily, queries, pages] = await Promise.all([
      gscQuery(auth.token, property, { ...range, dimensions: ['date'], rowLimit: days + 2 }),
      gscQuery(auth.token, property, { ...range, dimensions: ['query'], rowLimit: 10 }),
      gscQuery(auth.token, property, { ...range, dimensions: ['page'], rowLimit: 10 }),
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
      mode: auth.mode,
      property,
      summary: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: avgCtr,
        position: avgPosition,
        period: `Last ${days} days`,
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
    if (err.status === 403) {
      return NextResponse.json({
        connected: true,
        error: 'The connected Google account does not have access to this Search Console property',
      })
    }
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}





