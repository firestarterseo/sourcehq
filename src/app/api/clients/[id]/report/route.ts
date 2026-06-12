import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth } from '@/lib/google-auth'
import { getEconomicData, getWeatherData, getCalendarContext } from '@/lib/external-data'

export const maxDuration = 60

const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const CALLRAIL_API = 'https://api.callrail.com/v3'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

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
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

async function getGscData(clientId: string, days: number) {
  const auth = await getGoogleAuth(clientId)
  const property = auth.selection.gsc_property
  if (!auth.token || !property) return null

  const gscDays = Math.min(days, 480)
  const body = {
    startDate: isoDaysAgo(gscDays + 2),
    endDate: isoDaysAgo(2),
  }
  const run = async (dimensions: string[], rowLimit: number) => {
    const res = await fetch(`${GSC_API}/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, dimensions, rowLimit }),
    })
    if (!res.ok) return null
    return res.json()
  }

  const [daily, queries, pages] = await Promise.all([run(['date'], 500), run(['query'], 25), run(['page'], 25)])
  if (!daily) return null

  const byMonth: Record<string, { clicks: number; impressions: number }> = {}
  let clicks = 0
  let impressions = 0
  for (const r of daily.rows || []) {
    const month = r.keys[0].slice(0, 7)
    byMonth[month] = byMonth[month] || { clicks: 0, impressions: 0 }
    byMonth[month].clicks += r.clicks
    byMonth[month].impressions += r.impressions
    clicks += r.clicks
    impressions += r.impressions
  }

  return {
    property,
    daysCovered: gscDays,
    totals: { clicks, impressions },
    monthlyTrend: Object.entries(byMonth).map(([month, v]) => ({ month, ...v })),
    topQueries: (queries?.rows || []).map((r: any) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    topPages: (pages?.rows || []).map((r: any) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position })),
  }
}

async function getGa4Data(clientId: string, days: number) {
  const auth = await getGoogleAuth(clientId)
  const property = auth.selection.ga4_property
  if (!auth.token || !property) return null

  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }]
  const run = async (body: Record<string, unknown>) => {
    const res = await fetch(`${DATA_API}/${property}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return res.json()
  }

  const [totals, channels, pages, monthly] = await Promise.all([
    run({ dateRanges, metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }] }),
    run({ dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 }),
    run({ dateRanges, dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 15 }),
    run({ dateRanges, dimensions: [{ name: 'yearMonth' }], metrics: [{ name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'yearMonth' } }], limit: 36 }),
  ])
  if (!totals) return null

  const t = totals.rows?.[0]?.metricValues || []
  return {
    daysCovered: days,
    sessions: Number(t[0]?.value || 0),
    users: Number(t[1]?.value || 0),
    pageviews: Number(t[2]?.value || 0),
    channels: (channels?.rows || []).map((r: any) => ({ channel: r.dimensionValues[0].value, sessions: Number(r.metricValues[0].value) })),
    topPages: (pages?.rows || []).map((r: any) => ({ page: r.dimensionValues[0].value, sessions: Number(r.metricValues[0].value) })),
    monthlyTrend: (monthly?.rows || []).map((r: any) => ({ month: r.dimensionValues[0].value, sessions: Number(r.metricValues[0].value) })),
  }
}

async function getCallData(clientId: string, days: number) {
  const { data: connection } = await adminClient()
    .from('data_connections')
    .select('credentials, status')
    .eq('client_id', clientId)
    .eq('source_type', 'callrail')
    .single()

  if (!connection || connection.status !== 'connected') return null
  const creds = connection.credentials

  let apiKey: string
  let accountId: string
  let companyFilter = ''
  if (creds.mode === 'agency') {
    if (!process.env.CALLRAIL_AGENCY_KEY) return null
    apiKey = process.env.CALLRAIL_AGENCY_KEY
    accountId = creds.account_id
    companyFilter = `&company_id=${creds.company_id}`
    if (!accountId) {
      const accRes = await fetch(`${CALLRAIL_API}/a.json`, { headers: { Authorization: `Token token="${apiKey}"` } })
      if (!accRes.ok) return null
      accountId = (await accRes.json()).accounts?.[0]?.id
    }
  } else {
    apiKey = creds.api_key
    accountId = creds.account_id
  }

  const startDate = isoDaysAgo(days)
  const endDate = isoDaysAgo(0)
  const calls: any[] = []
  for (let page = 1; page <= 8; page++) {
    const res = await fetch(
      `${CALLRAIL_API}/a/${accountId}/calls.json?start_date=${startDate}&end_date=${endDate}&per_page=250&page=${page}&fields=source,duration,first_call,answered,start_time${companyFilter}`,
      { headers: { Authorization: `Token token="${apiKey}"` } }
    )
    if (!res.ok) return null
    const json = await res.json()
    calls.push(...(json.calls || []))
    if (!json.calls || json.calls.length < 250) break
  }

  const bySource: Record<string, number> = {}
  const byMonth: Record<string, number> = {}
  let answered = 0
  let firstTime = 0
  for (const c of calls) {
    bySource[c.source || 'Unknown'] = (bySource[c.source || 'Unknown'] || 0) + 1
    const month = (c.start_time || '').slice(0, 7)
    if (month) byMonth[month] = (byMonth[month] || 0) + 1
    if (c.answered) answered++
    if (c.first_call) firstTime++
  }
  return {
    daysCovered: days,
    totalCalls: calls.length,
    answered,
    firstTime,
    sources: Object.entries(bySource).map(([source, count]) => ({ source, calls: count })).sort((a, b) => b.calls - a.calls),
    monthlyTrend: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, calls: count })),
  }
}

function publicationPrompt(client: any, days: number, gsc: any, ga4: any, calls: any, econ: any, weather: any, calendar: any) {
  return `You are the publication engine for SOURCE HQ, built on the "SOURCED not Cited" methodology: businesses publish original insights from their own first-party data to become the cited source in their industry — in AI assistants (ChatGPT, Perplexity, Google AI Overviews), by journalists, and by other publishers.

Write a citable data publication for this business to publish under its own name.

Business: ${client.name}
Industry: ${client.industry || 'Unknown'}
Website: ${client.website || 'Unknown'}
Data window: last ${days} days (daysCovered fields show actual coverage per source; GSC caps at 16 months)

FIRST-PARTY DATA:
Search visibility (Google Search Console): ${JSON.stringify(gsc) || 'unavailable'}
Website traffic (Google Analytics): ${JSON.stringify(ga4) || 'unavailable'}
Inbound phone calls (CallRail): ${JSON.stringify(calls) || 'unavailable'}

EXTERNAL MARKET CONTEXT (public data, same window):
Economic indicators (FRED): ${JSON.stringify(econ) || 'unavailable'}
Weather, client metro (Open-Meteo): ${JSON.stringify(weather) || 'unavailable'}
Calendar context: ${JSON.stringify(calendar) || 'unavailable'}

RULES — these define whether the output succeeds:
- Audience is the PUBLIC and LLMs, not the business. Never give the business advice. Never mention meta descriptions, rankings to improve, internal strategy, or anything a competitor could exploit.
- Voice: the business speaking as an authority publishing its own research. First person plural where natural ("our data shows").
- Frame findings as INDUSTRY INSIGHT: turn the business data into observations about consumer behavior, demand patterns, seasonality, and market trends in its industry and geography. Use monthlyTrend data for seasonal and month-over-month findings — temporal patterns are the most citable material.
- CORRELATE the business data with the external context where patterns genuinely align: weather events, economic shifts, rate changes, elections, tax season. Hedge honestly — "coinciding with", "against a backdrop of" — never claim causation. A finding like "inquiries rose 35% in a month when the metro saw 11 freezing days" is the most original, citable material in the report. Do not force correlations that the data does not support.
- NEVER state absolute call counts, lead counts, or revenue figures. Express phone/lead findings ONLY as percentages, shares, ratios, and directional trends (e.g. "inquiries rose 35% month-over-month", "first-time prospects made up 86% of inquiries", "paid search drove roughly half of all inquiries"). Search impressions, clicks, and website sessions MAY be stated in absolute terms.
- Every statistic must come from the data above. State sample-size context honestly without revealing raw lead counts (e.g. "based on a modest inquiry sample" rather than "based on 78 calls").
- Write so a stranger in this industry would find it genuinely informative.

Respond with ONLY valid JSON, no markdown fences, exactly this shape:
{
  "title": "string - headline an industry publication would run; specific, includes geography/industry, ideally a number",
  "executive_summary": "string - 3-4 sentence standfirst summarizing the most citable findings",
  "wins": ["string - 3-5 key findings, each a self-contained citable statistic with context (render under 'Key findings')"],
  "concerns": ["string - 2-3 notable patterns or shifts, neutrally framed as market observations (render under 'Notable patterns')"],
  "opportunities": ["string - 2-4 implications for consumers or the industry (render under 'What this means')"],
  "actions": ["string - 2-3 methodology notes: data sources, collection window, limitations — without raw lead counts (render under 'Methodology')"]
}`
}

function internalPrompt(client: any, days: number, gsc: any, ga4: any, calls: any) {
  return `You are the analysis engine for SOURCE HQ, an SEO agency intelligence platform. Write an internal marketing analysis for the agency team managing this client.

Client: ${client.name}
Industry: ${client.industry || 'Unknown'}
Website: ${client.website || 'Unknown'}
Data window: last ${days} days

DATA:
Search Console: ${JSON.stringify(gsc) || 'not connected'}
Google Analytics: ${JSON.stringify(ga4) || 'not connected'}
CallRail: ${JSON.stringify(calls) || 'not connected'}

Rules:
- Every claim must reference specific numbers from the data
- Cross-reference sources (search vs sessions vs calls)
- Use monthlyTrend data to call out trends and seasonality
- Be honest about small numbers
- Be specific: name actual pages, queries, channels
- Recommendations must be concrete next actions

Respond with ONLY valid JSON, no markdown fences, exactly this shape:
{
  "title": "string",
  "executive_summary": "string - 3-5 sentences",
  "wins": ["string - 2-4 with numbers"],
  "concerns": ["string - 1-3 with numbers"],
  "opportunities": ["string - 2-4 grounded in data"],
  "actions": ["string - 3-5 concrete steps, most impactful first"]
}`
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: reports } = await adminClient()
    .from('reports')
    .select('id, title, period, created_at')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ reports: reports || [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  let reportType = 'publication'
  let days = 0
  try {
    const body = await request.json()
    if (body?.type === 'internal') reportType = 'internal'
    if (body?.days && [28, 90, 180, 365, 730].includes(Number(body.days))) days = Number(body.days)
  } catch {}
  if (!days) days = reportType === 'publication' ? 90 : 28

  const { data: client } = await adminClient()
    .from('clients')
    .select('name, industry, website')
    .eq('id', id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const [gsc, ga4, calls, econ, weather] = await Promise.all([
    getGscData(id, days),
    getGa4Data(id, days),
    getCallData(id, days),
    reportType === 'publication' ? getEconomicData(days) : Promise.resolve(null),
    reportType === 'publication' ? getWeatherData(days) : Promise.resolve(null),
  ])
  const calendar = reportType === 'publication' ? getCalendarContext(days) : null

  if (!gsc && !ga4 && !calls) {
    return NextResponse.json({ error: 'No connected data sources with data for this client yet' }, { status: 400 })
  }

  const prompt = reportType === 'publication'
    ? publicationPrompt(client, days, gsc, ga4, calls, econ, weather, calendar)
    : internalPrompt(client, days, gsc, ga4, calls)

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    return NextResponse.json({ error: `AI request failed: ${errText.slice(0, 200)}` }, { status: 500 })
  }

  const aiJson = await aiRes.json()
  const text = (aiJson.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')

  let content: any
  try {
    content = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return NextResponse.json({ error: 'AI returned unparseable content, try again' }, { status: 500 })
  }

  content.report_type = reportType

  const { data: report, error } = await adminClient()
    .from('reports')
    .insert({
      client_id: id,
      title: content.title || `${client.name} — SOURCE Report`,
      content,
      period: `Last ${days} days`,
    })
    .select('id, title, period, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ report })
}
