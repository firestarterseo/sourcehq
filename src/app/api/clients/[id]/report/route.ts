import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAuth } from '@/lib/google-auth'
import { getEconomicData, getWeatherData, getCalendarContext } from '@/lib/external-data'
import { getRegion } from '@/lib/regions'
import { analyzeMacro } from '@/lib/macro-analysis'
import type { MacroAnalysis } from '@/lib/macro-analysis'
import { buildComparisonChart, buildLineChart } from '@/lib/report-chart'
import type { ReportChart } from '@/lib/report-chart'
import type { SourceReport, ReportStat, ReportFinding, ReportSection, ReportFAQ } from '@/lib/report-types'

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
  if (calls.length === 0) return null
  const total = calls.length
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

// ---------------------------------------------------------------------------
// Deterministic assembly: numbers and identity come from code, never the LLM.
// ---------------------------------------------------------------------------

function approxNum(n: number): string {
  if (n >= 1_000_000) return `~${(Math.round(n / 100_000) / 10).toLocaleString('en-US')} million`
  if (n >= 100_000) return `~${(Math.round(n / 5_000) * 5_000).toLocaleString('en-US')}`
  if (n >= 10_000) return `~${(Math.round(n / 500) * 500).toLocaleString('en-US')}`
  if (n >= 1_000) return `~${(Math.round(n / 100) * 100).toLocaleString('en-US')}`
  return `~${Math.round(n / 10) * 10}`
}

function formatCoverage(days: number, regionLabel: string): string {
  const end = new Date()
  const start = new Date(Date.now() - days * 86_400_000)
  const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const startStr = fmt(start)
  const endStr = fmt(end)
  const range = startStr === endStr ? startStr : `${startStr} - ${endStr}`
  return regionLabel ? `${range}, ${regionLabel}` : range
}

// Key stats describe the SCALE of the dataset analyzed - never publisher
// performance. We deliberately exclude clicks (clicks + impressions = a
// derivable CTR, which is publisher performance, not a market fact) and the
// inquiry answer rate (operational self-reporting). What remains is neutral
// dataset scope.
function buildKeyStats(gsc: any, ga4: any, _calls: any, windowLabel: string): ReportStat[] {
  const stats: ReportStat[] = []
  if (gsc?.totals?.impressions) stats.push({ label: 'Search impressions analyzed', value: approxNum(gsc.totals.impressions) })
  if (ga4?.sessions) stats.push({ label: 'Web sessions analyzed', value: approxNum(ga4.sessions) })
  stats.push({ label: 'Observation window', value: windowLabel })
  return stats.slice(0, 4)
}

function buildDataSources(gsc: any, ga4: any, calls: any, econ: any, weather: any): string[] {
  const out: string[] = []
  if (gsc) out.push('Google Search Console - query- and page-level search demand for the analysis window.')
  if (ga4) out.push('Google Analytics - aggregate website session volume for the analysis window.')
  if (calls) out.push('CallRail - inbound inquiry timing, as a monthly seasonality index.')
  if (econ) out.push('FRED (Federal Reserve Economic Data) - macroeconomic indicators for the same window.')
  if (weather) out.push('Open-Meteo - regional weather observations for the market metro.')
  return out
}

// Bucket a thinned FRED series (daily/weekly points with date fields) to
// monthly averages so it aligns with the monthly demand series.
function bucketMonthly(series: any): { month: string; value: number }[] {
  if (!Array.isArray(series)) return []
  const buckets: Record<string, { sum: number; n: number }> = {}
  for (const p of series) {
    const date = p?.date
    const val = Number(p?.value)
    if (!date || !Number.isFinite(val)) continue
    const month = String(date).slice(0, 7)
    buckets[month] = buckets[month] || { sum: 0, n: 0 }
    buckets[month].sum += val
    buckets[month].n += 1
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({ month, value: b.sum / b.n }))
}

// Public reports show MARKET behavior, not publisher performance. Which chart
// we ship depends on whether demand is seasonal (from the deterministic macro
// analysis), because the two cases tell different honest stories:
//   SEASONAL     -> a single indexed demand line showing the seasonal SHAPE
//                   (peak/trough). We do NOT overlay macro series: correlating
//                   one seasonal year against macro trends is not defensible and
//                   the prose is forbidden from asserting it, so an overlay would
//                   visually imply a correlation the report declines to make.
//   NON-SEASONAL -> the indexed demand-vs-economic comparison, where the computed
//                   co-movements ARE valid and are the citable material.
// The caption is a deterministic, liftable claim built from the SAME computed
// numbers that draw the chart, so caption, chart, and table cannot diverge.
function monthLabel(m: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(String(m))
  if (!match) return String(m)
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return names[Number(match[2]) - 1] || String(m)
}

function buildCharts(gsc: any, ga4: any, econ: any, macro: MacroAnalysis): ReportChart[] {
  const charts: ReportChart[] = []

  let demandMonthly: { month: string; value: number }[] = []
  let demandLabel = ''
  if (gsc?.monthlyTrend?.length >= 2) {
    demandMonthly = gsc.monthlyTrend.map((m: any) => ({ month: m.month, value: m.impressions }))
    demandLabel = 'Search demand'
  } else if (ga4?.monthlyTrend?.length >= 2) {
    demandMonthly = ga4.monthlyTrend.map((m: any) => ({ month: m.month, value: m.sessions }))
    demandLabel = 'Web sessions'
  }

  if (demandMonthly.length < 2) return charts

  // SEASONAL: solo indexed demand line (peak = 100); caption states the shape.
  if (macro?.seasonal && macro.seasonalShape) {
    const s = macro.seasonalShape
    const peakVal = Math.max(...demandMonthly.map(p => p.value), 1)
    const indexed = demandMonthly.map(p => ({ month: p.month, value: Math.round((p.value / peakVal) * 100) }))
    const line = buildLineChart({
      title: demandLabel + ' is seasonal (indexed to peak = 100)',
      unitLabel: 'Demand index (seasonal peak = 100)',
      points: indexed,
    })
    if (line) {
      charts.push({
        ...line,
        caption: demandLabel + ' for this market peaks in ' + monthLabel(s.peakMonth) + ' at roughly ' + s.peakToTroughRatio + 'x its ' + monthLabel(s.troughMonth) + ' low - a recurring seasonal pattern, not a trend.',
      })
    }
    return charts
  }

  // NON-SEASONAL: indexed demand-vs-economic-context comparison.
  if (econ) {
    const comparison = buildComparisonChart('Demand vs. economic context (indexed)', [
      { label: demandLabel, monthly: demandMonthly, anchor: true },
      { label: 'Consumer sentiment', monthly: bucketMonthly(econ.us_consumer_sentiment_index) },
      { label: 'S&P 500', monthly: bucketMonthly(econ.sp500_index_close) },
      { label: '30-yr mortgage rate', monthly: bucketMonthly(econ.us_30yr_mortgage_rate_pct) },
    ])
    if (comparison) {
      const dc = macro?.demandChange
      const pushed: ReportChart = {
        title: comparison.title,
        unitLabel: 'Indexed to 100 at window start',
        svg: comparison.svg,
        points: comparison.rows.map(r => ({ month: r.month, value: r.values[0] ?? 0 })),
      }
      if (dc) {
        pushed.caption = 'Indexed to 100 at the window start, ' + demandLabel.toLowerCase() + ' moved ' + (dc.changePct >= 0 ? '+' : '') + dc.changePct + '% over the window (' + dc.direction + '), shown against U.S. economic indicators for context.'
      }
      charts.push(pushed)
    }
  }

  return charts
}

function assembleSourceReport(
  ai: any, client: any, region: any, days: number,
  gsc: any, ga4: any, calls: any, econ: any, weather: any, macro: MacroAnalysis, charts: ReportChart[]
): SourceReport {
  const publisher = String(client.publisherName || client.name).trim()
  const publisherUrl = client.website || undefined
  const datePublished = new Date().toISOString().split('T')[0]
  const year = datePublished.slice(0, 4)
  const coverage = formatCoverage(days, region.label)
  const title = String(ai.title || `${client.industry || 'Market'} signals, ${region.label}`)
  const citation = [`Cite this report as: ${publisher} (${year}). ${title}.`, publisherUrl].filter(Boolean).join(' ')

  const findings: ReportFinding[] = Array.isArray(ai.findings)
    ? ai.findings.map((f: any) => typeof f === 'string'
        ? { heading: '', body: f }
        : { heading: String(f.heading || ''), body: String(f.body || '') })
    : []

  const sections: ReportSection[] = Array.isArray(ai.sections)
    ? ai.sections.map((s: any) => ({
        heading: String(s.heading || ''),
        paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs.map(String) : (s.body ? [String(s.body)] : []),
      }))
    : []

  const faqs: ReportFAQ[] = Array.isArray(ai.faqs)
    ? ai.faqs.map((q: any) => ({ question: String(q.question || ''), answer: String(q.answer || '') }))
    : []

  return {
    title,
    dek: String(ai.dek || ''),
    publisher,
    publisherUrl,
    datePublished,
    coverage,
    citation,
    keyStats: buildKeyStats(gsc, ga4, calls, `Last ${days} days`),
    executiveSummary: Array.isArray(ai.executiveSummary)
      ? ai.executiveSummary.map(String)
      : (ai.executive_summary ? [String(ai.executive_summary)] : []),
    findings,
    sections,
    faqs,
    methodology: Array.isArray(ai.methodology) ? ai.methodology.map(String) : [],
    dataSources: buildDataSources(gsc, ga4, calls, econ, weather),
    macro,
    charts,
    keywords: Array.isArray(ai.keywords) ? ai.keywords.map(String) : [],
    about: Array.isArray(ai.about) ? ai.about.map(String) : [],
    abstract: String(ai.abstract || ai.dek || ''),
    sourceStampEnabled: true,
  }
}

function macroComputedBlock(macro: MacroAnalysis): string {
  if (!macro || macro.demandSource === 'none') {
    return 'COMPUTED MACRO ANALYSIS: no demand anchor available (neither search impressions nor sessions had enough monthly data), so do NOT assert any correlation between demand and economic indicators. Report economic figures as standalone context only.'
  }
  const demandLabel = macro.demandSource === 'gsc_impressions' ? 'search demand (search impressions)' : 'web sessions'
  const changeLines = macro.seriesChanges
    .map(s => `- ${s.series}: ${s.changePct >= 0 ? '+' : ''}${s.changePct}% over the window (${s.direction}).`)
    .join('\n')

  // Seasonal demand: characterize by SHAPE (peak/trough), never by an endpoint
  // "% change over the window" (that is a measurement artifact when the window
  // opens and closes on different phases of the cycle). Macro indicators are
  // CONTEXT ONLY - do not assert they move with demand over a single seasonal year.
  if (macro.seasonal && macro.seasonalShape) {
    const s = macro.seasonalShape
    return `COMPUTED MACRO ANALYSIS (deterministic - USE THESE NUMBERS, do not invent correlations):

DEMAND IS STRONGLY SEASONAL. Characterize it by its seasonal SHAPE, NOT by any start-to-end change:
- Peak month: ${s.peakMonth}. Trough month: ${s.troughMonth}. Peak-to-trough ratio: about ${s.peakToTroughRatio}x.
- CRITICAL: Do NOT state a "demand rose/fell X% over the window" figure. Because the window opens and closes on different points of the seasonal cycle, an endpoint change is a measurement artifact and would misrepresent a healthy seasonal business as growing or collapsing. Frame demand as a recurring seasonal pattern (peak in ${s.peakMonth}, trough in ${s.troughMonth}), not as a trend.

Economic indicators over the same window (CONTEXT ONLY):
${changeLines}

HOW TO USE THIS:
- Lead with the SEASONAL STRUCTURE of demand (when it peaks, when it troughs, how pronounced the swing is). That is the report's core, defensible finding.
- Present each economic indicator's window change as STANDALONE CONTEXT - state the figure as backdrop. Do NOT claim any economic indicator "moved with" or "moved inversely to" demand: correlating a seasonal demand curve against macro trends over a single year is not statistically meaningful, and asserting it would undermine the report's credibility.
- You may note that the economic backdrop (e.g. rates, sentiment) is broadly supportive or cautionary for the category in general terms, but do not tie it to the demand curve's direction.
- Keep LOCAL findings (seasonal search/inquiry pattern, weather) as the lead. National economic indicators are supporting context, never the headline.`
  }

  // Non-seasonal demand: endpoint change + computed co-movements are valid.
  const dc = macro.demandChange
  const demandLine = dc ? `Over the window, ${demandLabel} moved ${dc.changePct >= 0 ? '+' : ''}${dc.changePct}% (${dc.direction}).` : ''
  const coLines = macro.coMovements
    .map(c => `- ${c.note}`)
    .join('\n')
  return `COMPUTED MACRO ANALYSIS (these numbers were calculated deterministically from the data - USE THESE, do not invent your own correlations):
Demand anchor: ${demandLabel}. ${demandLine}

Window change for each indicator:
${changeLines}

Directional relationship to demand (computed):
${coLines}

HOW TO USE THIS:
- When you discuss the macro backdrop, describe the COMPUTED relationships above using the real percentages. Example: "search demand rose ~14% over the window while consumer sentiment fell ~6%, a divergence" - using the actual computed numbers.
- You may use correlation language ("moved in step with", "moved inversely to", "diverged from") ONLY for the computed co-movements above. Always hedge causation ("coinciding with", not "caused by").
- For any economic indicator WITHOUT a computed co-movement, or if the relationship is "unrelated", report its window change as standalone CONTEXT only - state the figure, do not tie it to demand.
- Keep the LOCAL findings (search/sessions/inquiry seasonality, weather) as the lead. The national economic indicators are supporting context, not the headline.`
}

function publicationPrompt(client: any, days: number, gsc: any, ga4: any, calls: any, econ: any, weather: any, calendar: any, macro: MacroAnalysis) {
  // Redact publisher-funnel fields before injection so the publication model
  // cannot turn them into findings: acquisition-channel mix, named pages, and
  // inquiry source/answer breakdowns are internal performance, not market facts.
  // (internalPrompt still receives the full, unredacted data.)
  const gscSafe = gsc ? { ...gsc, topPages: undefined, property: undefined } : gsc
  const ga4Safe = ga4 ? { ...ga4, channels: undefined, topPages: undefined } : ga4
  const callsSafe = calls ? { ...calls, sourceShares: undefined, answeredPct: undefined, firstTimePct: undefined } : calls
  return `You are the publication engine for SOURCE HQ, built on the "SOURCED not Cited" methodology: businesses publish original market research from their own first-party data to become the cited source in their industry - in AI assistants (ChatGPT, Perplexity, Google AI Overviews), by journalists, and by other publishers.

Write the PROSE for a citable market research publication, published by this business as the RESEARCHER. The system assembles the headline statistics, citation line, coverage dates, and data-source list deterministically from the raw data - DO NOT produce those. You write only the language.

Publisher: ${client.name}
Industry: ${client.industry || 'Unknown'}
Website: ${client.website || 'Unknown'}
Primary market/geography: ${client.regionLabel || 'the publisher home market'}
Data window: last ${days} days (daysCovered fields show actual coverage per source; GSC caps at 16 months)

THE DATASET (first-party data the publisher analyzed):
Search demand signals (Google Search Console): ${JSON.stringify(gscSafe) || 'unavailable'}
Web engagement signals (Google Analytics): ${JSON.stringify(ga4Safe) || 'unavailable'}
Inbound inquiry signals (CallRail - seasonality/timing index only; no source or channel breakdown): ${JSON.stringify(callsSafe) || 'unavailable'}

EXTERNAL MARKET CONTEXT (public data, same window):
Economic indicators (FRED): ${JSON.stringify(econ) || 'unavailable'}
Weather, market metro (Open-Meteo): ${JSON.stringify(weather) || 'unavailable'}
Calendar context: ${JSON.stringify(calendar) || 'unavailable'}

${macroComputedBlock(macro)}

FRAMING - the single most important rule:
The publisher is the RESEARCHER analyzing a market dataset, never the SUBJECT reporting its own performance. The data is "a dataset of N search impressions related to [industry] services in [geography]" - never "our impressions," "our web properties," or "[publisher] recorded."
- RIGHT: "We analyzed a dataset of roughly 3.8 million search impressions for [industry]-related queries in the [market]."
- Findings are statements about MARKET BEHAVIOR. The publisher appears only as the analyst ("our analysis found") and in the methodology as the data source.

WHAT A SEARCH IMPRESSION MEANS (use this framing for demand):
- A Google Search Console impression is logged when a result appeared on a loaded results page for a real search query. For standard web results it counts regardless of rank or whether anyone scrolled to or clicked it - a result at position 40 still logs an impression when that results page loads.
- Therefore treat impressions as a DIRECTIONAL PROXY FOR MARKET SEARCH DEMAND (the search happened), NOT as a measure of how many people saw the publisher and NOT as publisher visibility or performance.
- This proxy is bounded by the keyword footprint of the dataset (it reflects queries the analyzed content appeared for, not a census of all market searches). Say so when describing scope.

PERFORMANCE-LEAK RULES (critical - the publisher must never expose its own funnel):
- NEVER state or imply a click-through rate (CTR), and NEVER pair a click figure with an impression figure in a way that lets a reader derive one. Clicks divided by impressions is publisher performance, not a market fact.
- Do NOT report click counts as a headline statistic. Impressions (demand) are the volume metric, not clicks.
- NEVER state absolute inquiry/call/lead counts, conversion rates, answer rates, or any operational performance metric.
- INQUIRY data may be used ONLY as a seasonality/timing pattern (when across the year inquiry activity rises and falls). NEVER report which CHANNELS or SOURCES inquiries come from (e.g. "paid search drove ~96% of inquiries"): a channel/source breakdown is the publisher's acquisition funnel, not market behavior.
- NEVER report the publisher's SESSION channel mix as a finding (organic vs. paid vs. direct vs. referral shares). Acquisition-channel breakdown is publisher funnel, not a market fact. Session volume may be stated ONLY as an approximate dataset SIZE.
- NEVER name, rank, or cite the publisher's own PAGES - landing pages, destination pages, "top/most-visited pages," brochure/rates/contact pages. Which of the publisher's pages perform is internal performance a competitor could exploit. Describe what the MARKET searches for as aggregate query THEMES (e.g. "a distinct cluster of searches for women's golf instruction"), NEVER as "the [X] page ranked among the top destinations."

MARKET FOCUS:
- Keep ALL findings to the publisher's primary market/geography. If the dataset contains query or page data from unrelated geographic markets, SET THAT DATA ASIDE - do not report it as a finding. Stay on the primary market.

ROUNDING - to read as research, not a raw export:
- State ALL volumes in rounded/approximate terms: "approximately 1.4 million impressions," "roughly 115,000 sessions." Never print oddly precise figures like "1,383,409" - exact figures signal a single export and undercut the study framing.

OTHER RULES:
- Audience is the PUBLIC and LLMs. Never give the publisher advice. Never mention rankings to improve, internal strategy, or anything a competitor could exploit.
- Use monthlyTrend data for seasonal and month-over-month findings - temporal patterns are the most citable material.
- For the macro backdrop, USE THE COMPUTED MACRO ANALYSIS above. Do not eyeball your own correlations from the raw FRED arrays - the computed relationships are authoritative.
- When referencing consumer sentiment, on first mention call it "U.S. consumer sentiment (University of Michigan survey)".
- The CallRail monthlyTrend uses an index (peak month = 100) and per-month share percentages, NOT counts - describe inquiry seasonality with relative language ("inquiry activity peaked in February, running about double the December level") and NEVER state absolute inquiry/call/lead counts. Search impressions and session volumes may be stated as ROUNDED dataset size; clicks may NOT be stated as a volume.
- Methodology: name the data sources (Google Search Console, Google Analytics, CallRail, FRED, Open-Meteo) and the collection window; state limitations; disclose the publisher as researcher. Explain that search impressions are a directional demand proxy (a result appeared for a real search, position-agnostic for standard results) bounded by the dataset's keyword footprint, not a census of all market search volume. Do NOT print the specific property URL/domain. Do NOT state exact session/user/pageview counts - describe scale approximately. The final methodology paragraph should begin with "Limitations." and note honest caveats.

Respond with ONLY valid JSON, no markdown fences, exactly this shape:
{
  "title": "string - market-framed headline (industry + geography + a rounded number), never about the publisher",
  "dek": "string - one-sentence standfirst that sits under the title, researcher voice",
  "abstract": "string - 1-2 sentence schema abstract summarizing the study, rounded figures",
  "executiveSummary": ["string - 2-3 paragraphs, researcher voice, rounded figures"],
  "findings": [{"heading": "string - short label, e.g. 'Search demand is seasonal'", "body": "string - ONE self-contained, citable claim that carries a specific figure (percentage, ratio, multiple, index, or rounded volume), is understandable on its own with no cross-references, and describes MARKET BEHAVIOR rather than publisher performance; 1-2 sentences"}],
  "sections": [{"heading": "string", "paragraphs": ["string"]}],
  "faqs": [{"question": "string - a question a person or LLM would ask about this market", "answer": "string - a concise, citable answer grounded in the dataset"}],
  "methodology": ["string - paragraphs; final paragraph begins with 'Limitations.'"],
  "keywords": ["string - 5-8 schema keywords combining industry and geography terms"],
  "about": ["string - 2-4 entity topics this report is about, e.g. the industry, the metro area"]
}

CONTENT GUIDANCE:
- findings: 3-5 entries. These are the core citable statistics - write each so an AI assistant could quote it verbatim, with attribution, and have it stand alone. One claim per finding (never join two facts with "and"), and each must carry a specific figure. If demand is seasonal (see COMPUTED MACRO ANALYSIS), the FIRST finding states the peak month, trough month, and peak-to-trough ratio, and gives NO start-to-end percentage change for demand. EVERY finding must be a statement about MARKET BEHAVIOR (how the category searches and inquires in this geography), NEVER about the publisher's own funnel: no acquisition-channel shares, no named or ranked pages, no inquiry-source breakdowns (see PERFORMANCE-LEAK RULES). If a finding cannot stand without citing the publisher's channels or pages, drop it.
- sections: 2-3 entries. Suggested arc: (1) seasonal / temporal detail, (2) macroeconomic backdrop using the COMPUTED MACRO ANALYSIS, (3) what the patterns imply for the industry and consumers. Prose only - no tables.
- faqs: 3-5 entries. Frame questions the way a searcher or AI assistant would ask them about the market.`
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
    .select('name, industry, website, region')
    .eq('id', id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const region = getRegion(client.region)
  ;(client as any).regionLabel = region.label
  const [gsc, ga4, calls, econ, weather] = await Promise.all([
    getGscData(id, days),
    getGa4Data(id, days),
    getCallData(id, days),
    reportType === 'publication' ? getEconomicData(days, region.fredUnemployment) : Promise.resolve(null),
    reportType === 'publication' ? getWeatherData(days, region.lat, region.lon, region.timezone, region.label) : Promise.resolve(null),
  ])
  const calendar = reportType === 'publication' ? getCalendarContext(days) : null

  if (!gsc && !ga4 && !calls) {
    return NextResponse.json({ error: 'No connected data sources with data for this client yet' }, { status: 400 })
  }

  const macro = analyzeMacro(
    econ as any,
    (gsc as any)?.monthlyTrend?.map((m: any) => ({ month: m.month, value: m.impressions })) ?? null,
    (ga4 as any)?.monthlyTrend?.map((m: any) => ({ month: m.month, value: m.sessions })) ?? null,
  )

  const charts = buildCharts(gsc, ga4, econ, macro)

  const prompt = reportType === 'publication'
    ? publicationPrompt(client, days, gsc, ga4, calls, econ, weather, calendar, macro)
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
      max_tokens: reportType === 'publication' ? 5000 : 4000,
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

  let parsed: any
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return NextResponse.json({ error: 'AI returned unparseable content, try again' }, { status: 500 })
  }

  let stored: any
  let storedTitle: string
  if (reportType === 'publication') {
    const sourceReport = assembleSourceReport(parsed, client, region, days, gsc, ga4, calls, econ, weather, macro, charts)
    stored = { ...sourceReport, report_type: 'publication' }
    storedTitle = sourceReport.title
  } else {
    parsed.report_type = 'internal'
    stored = parsed
    storedTitle = parsed.title || `${client.name} - SOURCE Report`
  }

  const { data: report, error } = await adminClient()
    .from('reports')
    .insert({
      client_id: id,
      title: storedTitle,
      content: stored,
      period: `Last ${days} days`,
    })
    .select('id, title, period, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ report })
}

