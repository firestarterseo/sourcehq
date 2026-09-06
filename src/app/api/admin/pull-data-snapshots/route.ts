import { NextRequest, NextResponse } from 'next/server'
import { requireRole, AuthError, adminClient } from '@/lib/auth-context'
import { getGoogleAuth } from '@/lib/google-auth'

// Owner-gated. Populates the still-empty `data_snapshots` table by pulling
// current GSC/GA4/GBP/CallRail numbers for every client that has a
// connection, so God Mode has real cross-client raw data to aggregate
// instead of relying on AI Visibility (which only covers the original 23
// clients). This is meant to become a recurring job later; for now it's
// hit manually, in batches, since pulling ~470 external API calls (up to 3
// Google APIs plus CallRail across 134 clients) in one request would blow
// past a serverless timeout.
//
// Each successful pull inserts ONE NEW ROW into data_snapshots per
// (client, source) - this is intentionally append-only, not upsert, so
// repeated runs build a real time series for trend detection later. It is
// safe to re-run: nothing is deleted, a re-run just adds another data point.
//
// Takes a POST body of:
//   { offset?: number, limit?: number, days?: number, dryRun?: boolean }
// - offset/limit page through the client list (default limit 15, chosen to
//   comfortably fit inside a 300s function timeout even with 3 Google APIs
//   per client; lower it if a batch times out, raise it if batches finish
//   with time to spare).
// - days controls the lookback window per source (default 90, must be one
//   of 28/90/180/365/730 - the same set every per-client dashboard route
//   uses).
// - dryRun:true fetches and computes summaries but writes nothing, useful
//   for checking a batch's numbers before trusting it.
//
// Hit it repeatedly, following nextOffset until it comes back null:
//   POST https://sourcehq.vercel.app/api/admin/pull-data-snapshots
//   body: { offset: 0, limit: 15, dryRun: true }   <- sanity check first batch
//   body: { offset: 0, limit: 15 }                  <- real run, then offset: 15, 30, ...

export const maxDuration = 300

const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const GA4_DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const GBP_PERF_API = 'https://businessprofileperformance.googleapis.com/v1'
const CALLRAIL_API = 'https://api.callrail.com/v3'

function dateRangeDaysAgo(days: number) {
  const end = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

function isoDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

// ---------- GSC ----------
async function pullGsc(token: string, property: string, days: number) {
  const range = dateRangeDaysAgo(days)
  async function query(body: Record<string, unknown>) {
    const res = await fetch(`${GSC_API}/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error?.message ?? `GSC ${res.status}`)
    return json
  }
  const [daily, queries] = await Promise.all([
    query({ ...range, dimensions: ['date'], rowLimit: days + 2 }),
    query({ ...range, dimensions: ['query'], rowLimit: 10 }),
  ])
  const totals = (daily.rows || []).reduce(
    (acc: any, row: any) => ({ clicks: acc.clicks + row.clicks, impressions: acc.impressions + row.impressions }),
    { clicks: 0, impressions: 0 }
  )
  const avgPosition = daily.rows?.length > 0
    ? daily.rows.reduce((acc: number, row: any) => acc + row.position, 0) / daily.rows.length
    : 0
  const normalized = {
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr: totals.impressions > 0 ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
    position: Number(avgPosition.toFixed(2)),
    topQueries: (queries.rows || []).slice(0, 10).map((row: any) => ({
      query: row.keys[0], clicks: row.clicks, impressions: row.impressions,
    })),
  }
  return { range, raw: { daily, queries }, normalized }
}

// ---------- GA4 ----------
async function pullGa4(token: string, property: string, days: number) {
  async function runReport(body: Record<string, unknown>) {
    const res = await fetch(`${GA4_DATA_API}/${property}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error?.message ?? `GA4 ${res.status}`)
    return json
  }
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }]
  const [totalsReport, channelsReport] = await Promise.all([
    runReport({ dateRanges, metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'conversions' }] }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 8,
    }),
  ])
  const totalsRow = totalsReport.rows?.[0]?.metricValues || []
  const sessions = Number(totalsRow[0]?.value || 0)
  const conversions = Number(totalsRow[3]?.value || 0)
  const normalized = {
    sessions,
    users: Number(totalsRow[1]?.value || 0),
    pageviews: Number(totalsRow[2]?.value || 0),
    conversions,
    conversionRate: sessions > 0 ? Number(((conversions / sessions) * 100).toFixed(2)) : 0,
    channels: (channelsReport.rows || []).map((row: any) => ({
      channel: row.dimensionValues[0].value, sessions: Number(row.metricValues[0].value),
    })),
  }
  return { range: dateRanges[0], raw: { totalsReport, channelsReport }, normalized }
}

// ---------- GBP ----------
const GBP_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'WEBSITE_CLICKS',
]
async function pullGbp(token: string, location: string, days: number) {
  const start = isoDaysAgo(Math.min(days, 540) + 3)
  const end = isoDaysAgo(3)
  const url = new URL(`${GBP_PERF_API}/${location}:fetchMultiDailyMetricsTimeSeries`)
  GBP_METRICS.forEach(m => url.searchParams.append('dailyMetrics', m))
  url.searchParams.set('dailyRange.start_date.year', String(start.y))
  url.searchParams.set('dailyRange.start_date.month', String(start.m))
  url.searchParams.set('dailyRange.start_date.day', String(start.d))
  url.searchParams.set('dailyRange.end_date.year', String(end.y))
  url.searchParams.set('dailyRange.end_date.month', String(end.m))
  url.searchParams.set('dailyRange.end_date.day', String(end.d))
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json()
  if (!res.ok) {
    const msg = json?.error?.message || `GBP ${res.status}`
    const pending = res.status === 403 || /not been used|disabled|permission|accessNotConfigured|SERVICE_DISABLED/i.test(msg)
    throw Object.assign(new Error(msg), { pending })
  }
  const series: Record<string, { date: string; value: number }[]> = {}
  for (const block of json.multiDailyMetricTimeSeries || []) {
    for (const dm of block.dailyMetricTimeSeries || []) {
      series[dm.dailyMetric] = (dm.timeSeries?.datedValues || []).map((p: any) => ({
        date: `${p.date.year}-${String(p.date.month).padStart(2, '0')}-${String(p.date.day).padStart(2, '0')}`,
        value: Number(p.value || 0),
      }))
    }
  }
  const sumMetric = (keys: string[]) => keys.reduce((t, k) => t + (series[k] || []).reduce((s, p) => s + p.value, 0), 0)
  const normalized = {
    searchViews: sumMetric(['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH']),
    mapsViews: sumMetric(['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS']),
    calls: sumMetric(['CALL_CLICKS']),
    directions: sumMetric(['BUSINESS_DIRECTION_REQUESTS']),
    websiteClicks: sumMetric(['WEBSITE_CLICKS']),
  }
  return {
    range: { startDate: `${start.y}-${String(start.m).padStart(2, '0')}-${String(start.d).padStart(2, '0')}`, endDate: `${end.y}-${String(end.m).padStart(2, '0')}-${String(end.d).padStart(2, '0')}` },
    raw: json,
    normalized,
  }
}

// ---------- CallRail ----------
function callrailAuthHeaders(apiKey: string) {
  return { Authorization: `Token token="${apiKey}"` }
}
async function pullCallrail(creds: any, days: number) {
  let apiKey: string
  let accountId: string
  let companyFilter = ''
  if (creds.mode === 'agency') {
    if (!process.env.CALLRAIL_AGENCY_KEY) throw new Error('Agency CallRail key not configured')
    apiKey = process.env.CALLRAIL_AGENCY_KEY
    if (creds.account_id) {
      accountId = creds.account_id
    } else {
      const accRes = await fetch(`${CALLRAIL_API}/a.json`, { headers: callrailAuthHeaders(apiKey) })
      if (!accRes.ok) throw new Error('Agency CallRail key was rejected')
      const accJson = await accRes.json()
      accountId = accJson.accounts?.[0]?.id
    }
    companyFilter = creds.company_id ? `&company_id=${creds.company_id}` : ''
  } else {
    apiKey = creds.api_key
    accountId = creds.account_id
  }

  const range = dateRangeDaysAgo(days)
  const calls: any[] = []
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(
      `${CALLRAIL_API}/a/${accountId}/calls.json?start_date=${range.startDate}&end_date=${range.endDate}&per_page=250&page=${page}&fields=source,duration,first_call,answered,start_time${companyFilter}`,
      { headers: callrailAuthHeaders(apiKey) }
    )
    if (!res.ok) throw new Error(`CallRail error (${res.status})`)
    const json = await res.json()
    calls.push(...(json.calls || []))
    if (!json.calls || json.calls.length < 250) break
  }
  let answered = 0, firstTime = 0, totalDuration = 0
  const bySource: Record<string, number> = {}
  for (const c of calls) {
    const src = c.source || 'Unknown'
    bySource[src] = (bySource[src] || 0) + 1
    if (c.answered) answered++
    if (c.first_call) firstTime++
    totalDuration += c.duration || 0
  }
  const normalized = {
    totalCalls: calls.length,
    answered,
    missed: calls.length - answered,
    firstTime,
    avgDurationSec: calls.length ? Math.round(totalDuration / calls.length) : 0,
    sources: Object.entries(bySource).map(([source, count]) => ({ source, calls: count })).sort((a, b) => b.calls - a.calls).slice(0, 8),
  }
  return { range, raw: { callCount: calls.length }, normalized }
}

// Inserts one snapshot row and THROWS if the insert itself failed, so a
// silent DB-side rejection (bad constraint, oversized payload, whatever)
// surfaces as an 'error' status instead of being reported as 'ok' just
// because the external API pull succeeded. Do not call supabase.insert()
// directly in the handlers below, always go through this.
async function insertSnapshot(supabase: ReturnType<typeof adminClient>, row: {
  connection_id: string; source_type: string; period_start: string; period_end: string; raw_data: unknown; normalized_data: unknown
}) {
  const { error } = await supabase.from('data_snapshots').insert(row)
  if (error) throw new Error(`data_snapshots insert failed: ${error.message}`)
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('owner')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  let body: any = {}
  try { body = await request.json() } catch { /* defaults below */ }

  const limit = Number(body.limit) > 0 ? Number(body.limit) : 15
  const offset = Number(body.offset) >= 0 ? Number(body.offset) : 0
  const days = [28, 90, 180, 365, 730].includes(Number(body.days)) ? Number(body.days) : 90
  const dryRun = body.dryRun === true

  const supabase = adminClient()

  const { data: allClients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name')
    .order('id', { ascending: true })
  if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 500 })

  const slice = (allClients || []).slice(offset, offset + limit)
  const results: any[] = []

  for (const client of slice) {
    const { data: connections } = await supabase
      .from('data_connections')
      .select('id, source_type, credentials, status')
      .eq('client_id', client.id)
      .in('source_type', ['google', 'callrail'])

    const googleConn = (connections || []).find(c => c.source_type === 'google' && c.status === 'connected')
    const callrailConn = (connections || []).find(c => c.source_type === 'callrail' && c.status === 'connected')

    const clientResult: any = { client_id: client.id, name: client.name, sources: {} }

    if (googleConn) {
      const creds = googleConn.credentials || {}

      if (creds.gsc_property) {
        try {
          const auth = await getGoogleAuth(client.id)
          if (!auth.token) throw new Error('No working Google token')
          const pulled = await pullGsc(auth.token, creds.gsc_property, days)
          clientResult.sources.gsc = { status: 'ok', ...pulled.normalized }
          if (!dryRun) {
            await insertSnapshot(supabase, {
              connection_id: googleConn.id, source_type: 'gsc',
              period_start: pulled.range.startDate, period_end: pulled.range.endDate,
              raw_data: pulled.raw, normalized_data: pulled.normalized,
            })
          }
        } catch (err: any) {
          clientResult.sources.gsc = { status: 'error', error: err.message }
        }
      }

      if (creds.ga4_property) {
        try {
          const auth = await getGoogleAuth(client.id)
          if (!auth.token) throw new Error('No working Google token')
          const pulled = await pullGa4(auth.token, creds.ga4_property, days)
          clientResult.sources.ga4 = { status: 'ok', ...pulled.normalized }
          if (!dryRun) {
            await insertSnapshot(supabase, {
              connection_id: googleConn.id, source_type: 'ga4',
              period_start: pulled.range.startDate, period_end: pulled.range.endDate,
              raw_data: pulled.raw, normalized_data: pulled.normalized,
            })
          }
        } catch (err: any) {
          clientResult.sources.ga4 = { status: 'error', error: err.message }
        }
      }

      if (creds.gbp_location) {
        try {
          const auth = await getGoogleAuth(client.id, 'gbp')
          if (!auth.token) throw new Error('No working Google token')
          const pulled = await pullGbp(auth.token, creds.gbp_location, days)
          clientResult.sources.gbp = { status: 'ok', ...pulled.normalized }
          if (!dryRun) {
            await insertSnapshot(supabase, {
              connection_id: googleConn.id, source_type: 'gbp',
              period_start: pulled.range.startDate, period_end: pulled.range.endDate,
              raw_data: pulled.raw, normalized_data: pulled.normalized,
            })
          }
        } catch (err: any) {
          clientResult.sources.gbp = { status: 'error', error: err.message, pending: err.pending || false }
        }
      }
    }

    if (callrailConn) {
      try {
        const pulled = await pullCallrail(callrailConn.credentials || {}, days)
        clientResult.sources.callrail = { status: 'ok', ...pulled.normalized }
        if (!dryRun) {
          await insertSnapshot(supabase, {
            connection_id: callrailConn.id, source_type: 'callrail',
            period_start: pulled.range.startDate, period_end: pulled.range.endDate,
            raw_data: pulled.raw, normalized_data: pulled.normalized,
          })
        }
      } catch (err: any) {
        clientResult.sources.callrail = { status: 'error', error: err.message }
      }
    }

    results.push(clientResult)
  }

  const total = (allClients || []).length
  const nextOffset = offset + limit < total ? offset + limit : null

  let snapshotsCreated = 0
  let errors = 0
  for (const r of results) {
    for (const s of Object.values(r.sources) as any[]) {
      if (s.status === 'ok') snapshotsCreated++
      else errors++
    }
  }

  return NextResponse.json({
    dryRun,
    days,
    offset,
    limit,
    totalClients: total,
    processed: slice.length,
    nextOffset,
    snapshotsCreated,
    errors,
    results,
  })
}
