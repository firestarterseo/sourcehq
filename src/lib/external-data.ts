// External context data for SOURCE publications:
// FRED economic series, Open-Meteo weather history, and calendar context.
// All sources are free/public. Client location defaults to Denver for now.

const FRED_API = 'https://api.stlouisfed.org/fred/series/observations'

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

async function fredSeries(seriesId: string, days: number) {
  if (!process.env.FRED_API_KEY) return null
  try {
    const url = `${FRED_API}?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&observation_start=${isoDaysAgo(days + 45)}&sort_order=asc`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    return (json.observations || [])
      .filter((o: any) => o.value !== '.')
      .map((o: any) => ({ date: o.date, value: Number(o.value) }))
  } catch {
    return null
  }
}

export async function getEconomicData(days: number, fredUnemployment: string | null = 'DENV708URN') {
  const [denverUnemployment, consumerSentiment, mortgage30, fedFunds] = await Promise.all([
    fredSeries(fredUnemployment || 'UNRATE', days),   // metro unemployment, or national fallback
    fredSeries('UMCSENT', days),      // University of Michigan consumer sentiment
    fredSeries('MORTGAGE30US', days), // 30-year fixed mortgage average
    fredSeries('FEDFUNDS', days),     // Federal funds effective rate
  ])

  if (!denverUnemployment && !consumerSentiment && !mortgage30 && !fedFunds) return null

  // Thin weekly series to monthly-ish to keep the prompt compact
  const thin = (arr: any[] | null) => {
    if (!arr) return null
    if (arr.length <= 14) return arr
    const step = Math.ceil(arr.length / 14)
    return arr.filter((_, i) => i % step === 0 || i === arr.length - 1)
  }

  return {
    local_unemployment_rate_pct: thin(denverUnemployment),
    us_consumer_sentiment_index: thin(consumerSentiment),
    us_30yr_mortgage_rate_pct: thin(mortgage30),
    fed_funds_rate_pct: thin(fedFunds),
  }
}

export async function getWeatherData(days: number, lat = 39.7392, lon = -104.9903, timezone = 'America/Denver') {
  try {
    const cappedDays = Math.min(days, 730)
    const start = isoDaysAgo(cappedDays)
    const end = isoDaysAgo(3) // archive API lags a couple days
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=${encodeURIComponent(timezone)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const d = json.daily
    if (!d?.time) return null

    // Aggregate to monthly: avg high/low, total precip/snow, extreme days
    const months: Record<string, { highs: number[]; lows: number[]; precip: number; snow: number; daysBelow32: number; daysAbove90: number }> = {}
    for (let i = 0; i < d.time.length; i++) {
      const m = d.time[i].slice(0, 7)
      months[m] = months[m] || { highs: [], lows: [], precip: 0, snow: 0, daysBelow32: 0, daysAbove90: 0 }
      months[m].highs.push(d.temperature_2m_max[i])
      months[m].lows.push(d.temperature_2m_min[i])
      months[m].precip += d.precipitation_sum[i] || 0
      months[m].snow += d.snowfall_sum[i] || 0
      if (d.temperature_2m_max[i] <= 32) months[m].daysBelow32++
      if (d.temperature_2m_max[i] >= 90) months[m].daysAbove90++
    }

    const avg = (a: number[]) => a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : null

    return {
      location: ${lat},${lon},
      monthly: Object.entries(months).map(([month, v]) => ({
        month,
        avg_high_f: avg(v.highs),
        avg_low_f: avg(v.lows),
        total_precip_in: Math.round(v.precip * 10) / 10,
        total_snow_in: Math.round(v.snow * 10) / 10,
        freezing_days: v.daysBelow32,
        days_above_90f: v.daysAbove90,
      })),
    }
  } catch {
    return null
  }
}

export function getCalendarContext(days: number) {
  const end = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const events: { date: string; event: string }[] = [
    { date: '2024-11-05', event: 'US general election (presidential)' },
    { date: '2025-04-15', event: 'Federal tax filing deadline' },
    { date: '2025-11-27', event: 'Thanksgiving (US)' },
    { date: '2025-11-28', event: 'Black Friday' },
    { date: '2025-12-25', event: 'Christmas' },
    { date: '2026-01-01', event: 'New Year' },
    { date: '2026-04-15', event: 'Federal tax filing deadline' },
    { date: '2026-06-30', event: 'Colorado primary election' },
    { date: '2026-11-03', event: 'US midterm general election' },
  ]

  const inWindow = events.filter(e => {
    const d = new Date(e.date)
    return d >= start && d <= end
  })

  const upcoming = events.filter(e => {
    const d = new Date(e.date)
    const ninetyOut = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    return d > end && d <= ninetyOut
  })

  return {
    note: '2026 is a US midterm election year; political ad spend typically inflates digital advertising costs and can crowd attention in Q3–Q4. Colorado school year runs mid-Aug to late May.',
    events_in_data_window: inWindow,
    upcoming_events: upcoming,
  }
}




