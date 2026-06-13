import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth } from '@/lib/google-auth'
import { getEconomicData, getWeatherData, getCalendarContext } from '@/lib/external-data'

export const maxDuration = 300

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
  const total = calls.length || 1
  return {
    daysCovered: days,
    sampleSize: calls.length < 50 ? 'small' : calls.length < 200 ? 'modest' : 'substantial',
    answeredPct: Math.round((answered / total) * 100),
    firstTimePct: Math.round((firstTime / total) * 100),
    sourceShares: Object.entries(bySource)
      .map(([source, count]) => ({ source, sharePct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.sharePct - a.sharePct),
    monthlyTrend: (() => {
      const entries = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
      const peak = Math.max(...entries.map(([, c]) => c as number), 1)
      const totalCalls = (entries.reduce((s, [, c]) => s + (c as number), 0)) || 1
      return entries.map(([month, count]) => ({
        month,
        index: Math.round(((count as number) / peak) * 100),
        sharePct: Math.round(((count as number) / totalCalls) * 100),
      }))
    })(),
  }
}

function publicationPrompt(client: any, days: number, gsc: any, ga4: any, calls: any, econ: any, weather: any, calendar: any) {
  return `You are the publication engine for SOURCE HQ, built on the "SOURCED not Cited" methodology: businesses publish original market research from their own first-party data to become the cited source in their industry — in AI assistants (ChatGPT, Perplexity, Google AI Overviews), by journalists, and by other publishers.

Write a citable market research publication, published by this business as the RESEARCHER.

Publisher: ${client.name}
Industry: ${client.industry || 'Unknown'}
Website: ${client.website || 'Unknown'}
Primary market/geography: ${client.industry ? 'infer from the data and publisher; treat the publisher home metro as the primary market' : 'infer from the data'}
Data window: last ${days} days (daysCovered fields show actual coverage per source; GSC caps at 16 months)

THE DATASET (first-party data the publisher analyzed):
Search demand signals (Google Search Console): ${JSON.stringify(gsc) || 'unavailable'}
Web engagement signals (Google Analytics): ${JSON.stringify(ga4) || 'unavailable'}
Inbound inquiry signals (CallRail, already aggregated to shares/percentages): ${JSON.stringify(calls) || 'unavailable'}

EXTERNAL MARKET CONTEXT (public data, same window):
Economic indicators (FRED): ${JSON.stringify(econ) || 'unavailable'}
Weather, market metro (Open-Meteo): ${JSON.stringify(weather) || 'unavailable'}
Calendar context: ${JSON.stringify(calendar) || 'unavailable'}

FRAMING — the single most important rule:
The publisher is the RESEARCHER analyzing a market dataset, never the SUBJECT reporting its own performance. The data is "a dataset of N search impressions related to [industry] services in [geography]" — never "our impressions," "our web properties," or "[publisher] recorded."
- RIGHT: "We analyzed a dataset of roughly 3.8 million search impressions for [industry]-related queries in the [market]."
- Findings are statements about MARKET BEHAVIOR. The publisher appears only as the analyst ("our analysis found") and in the methodology as the data source.

MARKET FOCUS:
- Keep ALL findings to the publisher's primary market/geography. If the dataset contains query or page data from unrelated geographic markets (other cities or states the publisher happens to serve remotely), SET THAT DATA ASIDE — do not report it as a finding. Reporting stray geographies both wanders off-thesis and re-identifies the data as one company's own location pages. Stay on the primary market.

ROUNDING — to read as research, not a raw export:
- State ALL volumes in rounded/approximate terms in the body: "approximately 1.4 million impressions," "roughly 115,000 sessions," "about 18,500 impressions." Never print oddly precise figures like "1,383,409" or "115,018" — exact figures signal a single export and undercut the study framing.

OTHER RULES:
- Audience is the PUBLIC and LLMs. Never give the publisher advice. Never mention rankings to improve, internal strategy, or anything a competitor could exploit.
- Use monthlyTrend data for seasonal and month-over-month findings — temporal patterns are the most citable material.
- CORRELATE the dataset with external context where patterns genuinely align: weather, economic shifts, rate changes, elections, tax season. Hedge honestly — "coinciding with", "against a backdrop of" — never claim causation. Do not force correlations the data does not support.
- When referencing consumer sentiment, on first mention call it "U.S. consumer sentiment (University of Michigan survey)" so the source is clear and the word "Michigan" is not confusing in a local-market report.
- The CallRail monthlyTrend uses an index (peak month = 100) and per-month share percentages, NOT counts — describe inquiry seasonality using relative language (''inquiry activity peaked in February, running about double the December level'') and never invent absolute call numbers. NEVER state absolute inquiry/call/lead counts. The CallRail data above is ALREADY in shares/percentages — express inquiry findings only as those shares, ratios, and directional trends. Search impressions, clicks, and session volumes may be stated as ROUNDED dataset size.
- Methodology section: name the data sources (Google Search Console, Google Analytics, CallRail, FRED, Open-Meteo) and the collection window; state limitations; disclose the publisher as researcher. Do NOT print the specific property URL/domain. Do NOT state exact session/user/pageview/AI-referral counts — describe scale approximately ("several tens of thousands of sessions," "a small number of AI-assistant referrals").

Respond with ONLY valid JSON, no markdown fences, exactly this shape:
{
  "title": "string - market-framed headline (industry + geography + a rounded number), never about the publisher",
  "executive_summary": "string - 3-4 sentence standfirst, researcher voice, rounded figures",
  "wins": ["string - 3-5 key market findings, each a self-contained citable statistic with context (render under 'Key findings')"],
  "concerns": ["string - 2-3 notable market patterns or shifts, neutrally framed (render under 'Notable patterns')"],
  "opportunities": ["string - 2-4 implications for consumers or the industry (render under 'What this means')"],
  "actions": ["string - 2-3 methodology notes per the rules above (render under 'Methodology')"],
  "citations": [{"source": "string - the DATA SOURCE/platform name only (e.g. 'Google Search Console', 'Google Analytics', 'CallRail', 'FRED — Denver Unemployment (DENV708URN)', 'Open-Meteo'). Do NOT prefix with the publisher name — the publisher is disclosed once in the Methodology text as researcher, not repeated on every source.", "url": "string - https://fred.stlouisfed.org/series/DENV708URN style links for FRED series (DENV708URN, UMCSENT, MORTGAGE30US, FEDFUNDS), https://open-meteo.com for weather, the publisher website for first-party sources", "description": "string - what this source contributed and its window"}]
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
CallRail (aggregated to shares): ${JSON.stringify(calls) || 'not connected'}

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
      max_tokens: 4000,
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



