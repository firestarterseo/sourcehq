import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth } from '@/lib/google-auth'

const PERF_API = 'https://businessprofileperformance.googleapis.com/v1'

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

function isoDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

const METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'CALL_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'WEBSITE_CLICKS',
]

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = [28, 90, 180, 365, 730].includes(daysParam) ? daysParam : 90
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const auth = await getGoogleAuth(id)
  if (!auth.token) {
    return NextResponse.json({ connected: false, revoked: auth.revoked || false })
  }

  const location = auth.selection.gbp_location
  if (!location) {
    return NextResponse.json({ connected: true, needsSelection: true })
  }

  const start = isoDaysAgo(Math.min(days, 540) + 3)
  const end = isoDaysAgo(3)

  try {
    const url = new URL(`${PERF_API}/${location}:fetchMultiDailyMetricsTimeSeries`)
    METRICS.forEach(m => url.searchParams.append('dailyMetrics', m))
    url.searchParams.set('dailyRange.start_date.year', String(start.y))
    url.searchParams.set('dailyRange.start_date.month', String(start.m))
    url.searchParams.set('dailyRange.start_date.day', String(start.d))
    url.searchParams.set('dailyRange.end_date.year', String(end.y))
    url.searchParams.set('dailyRange.end_date.month', String(end.m))
    url.searchParams.set('dailyRange.end_date.day', String(end.d))

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    const json = await res.json()

    if (!res.ok) {
      const msg = json?.error?.message || `GBP ${res.status}`
      const pending = res.status === 403 || /not been used|disabled|permission|accessNotConfigured|SERVICE_DISABLED/i.test(msg)
      return NextResponse.json({
        connected: true,
        error: pending
          ? 'Google Business Profile API access is not active yet. Once Google approves API access and the Performance API is enabled, this will populate automatically.'
          : msg,
        pending,
      })
    }

    const series: Record<string, { date: string; value: number }[]> = {}
    for (const block of json.multiDailyMetricTimeSeries || []) {
      for (const dm of block.dailyMetricTimeSeries || []) {
        const metric = dm.dailyMetric
        const points = (dm.timeSeries?.datedValues || []).map((p: any) => {
          const dt = p.date
          const date = `${dt.year}-${String(dt.month).padStart(2, '0')}-${String(dt.day).padStart(2, '0')}`
          return { date, value: Number(p.value || 0) }
        })
        series[metric] = points
      }
    }

    const sumMetric = (keys: string[]) => {
      let total = 0
      for (const k of keys) for (const p of series[k] || []) total += p.value
      return total
    }

    const searchViews = sumMetric(['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'])
    const mapsViews = sumMetric(['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'])
    const calls = sumMetric(['CALL_CLICKS'])
    const directions = sumMetric(['BUSINESS_DIRECTION_REQUESTS'])
    const websiteClicks = sumMetric(['WEBSITE_CLICKS'])

    const dailyMap: Record<string, number> = {}
    for (const k of ['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS']) {
      for (const p of series[k] || []) dailyMap[p.date] = (dailyMap[p.date] || 0) + p.value
    }
    const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, views: value }))

    return NextResponse.json({
      connected: true,
      mode: auth.mode,
      locationName: auth.selection.gbp_location_name || location,
      summary: { searchViews, mapsViews, calls, directions, websiteClicks, period: `Last ${days} days` },
      daily,
    })
  } catch (err: any) {
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}
