import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth } from '@/lib/google-auth'

const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'

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

async function runReport(token: string, property: string, body: Record<string, unknown>) {
  const res = await fetch(`${DATA_API}/${property}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    const err: any = new Error(json?.error?.message ?? `GA4 ${res.status}`)
    err.status = res.status
    throw err
  }
  return json
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = [28, 90, 180, 365, 730].includes(daysParam) ? daysParam : 28
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const auth = await getGoogleAuth(id)
  if (!auth.token) {
    return NextResponse.json({ connected: false, revoked: auth.revoked || false })
  }

  const property = auth.selection.ga4_property
  if (!property) {
    return NextResponse.json({ connected: true, needsSelection: true })
  }

  try {
    const dateRanges = [{ startDate: ${days}daysAgo, endDate: 'yesterday' }]

    const [totalsReport, dailyReport, pagesReport, channelsReport] = await Promise.all([
      runReport(auth.token, property, {
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
      }),
      runReport(auth.token, property, {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: days + 2,
      }),
      runReport(auth.token, property, {
        dateRanges,
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      runReport(auth.token, property, {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
    ])

    const totalsRow = totalsReport.rows?.[0]?.metricValues || []

    return NextResponse.json({
      connected: true,
      mode: auth.mode,
      propertyName: auth.selection.ga4_property_name || property,
      summary: {
        sessions: Number(totalsRow[0]?.value || 0),
        users: Number(totalsRow[1]?.value || 0),
        pageviews: Number(totalsRow[2]?.value || 0),
        period: Last  days,
      },
      daily: (dailyReport.rows || []).map((row: any) => ({
        date: `${row.dimensionValues[0].value.slice(0, 4)}-${row.dimensionValues[0].value.slice(4, 6)}-${row.dimensionValues[0].value.slice(6, 8)}`,
        sessions: Number(row.metricValues[0].value),
      })),
      topPages: (pagesReport.rows || []).map((row: any) => ({
        page: row.dimensionValues[0].value || '/',
        sessions: Number(row.metricValues[0].value),
      })),
      channels: (channelsReport.rows || []).map((row: any) => ({
        channel: row.dimensionValues[0].value,
        sessions: Number(row.metricValues[0].value),
      })),
    })
  } catch (err: any) {
    if (err.status === 403) {
      return NextResponse.json({
        connected: true,
        error: 'The connected Google account does not have access to this Analytics property',
      })
    }
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}

