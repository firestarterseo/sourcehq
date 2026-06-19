// src/lib/macro-analysis.ts
// Deterministic macro analysis: computes window-change and directional
// co-movement between a client demand series and each macro series.
// Numbers come from arithmetic here, NEVER from the LLM. The report prose
// describes these computed relationships rather than asserting its own.
//
// Seasonality guard: when the demand series is strongly seasonal (large
// peak-to-trough swing with endpoints on different phases), a single-year
// "demand changed X% over the window" figure is a measurement artifact, and
// correlating a weather-driven demand curve against macro trends over ~12
// points is not defensible. In that case we characterize demand by its
// seasonal SHAPE (peak/trough) and mark macro indicators as CONTEXT-ONLY.

type Point = { date?: string; month?: string; value: number }
type MonthlyDemand = { month: string; value: number }

export interface SeriesChange {
  series: string          // human label, e.g. "S&P 500"
  startValue: number
  endValue: number
  changePct: number       // rounded to 1 decimal
  direction: 'rising' | 'falling' | 'flat'
}

export interface CoMovement {
  series: string
  relationship: 'same-direction' | 'inverse' | 'unrelated'
  note: string            // plain-language summary for the prompt
}

export interface SeasonalShape {
  peakMonth: string
  troughMonth: string
  peakValue: number
  troughValue: number
  peakToTroughRatio: number   // peak / trough, rounded to 1 decimal
}

export interface MacroAnalysis {
  demandSource: 'gsc_impressions' | 'ga4_sessions' | 'none'
  demandChange: SeriesChange | null
  seriesChanges: SeriesChange[]
  coMovements: CoMovement[]
  seasonal: boolean             // true => demand is dominated by seasonality
  seasonalShape: SeasonalShape | null
}

function slopeSign(values: number[]): -1 | 0 | 1 {
  if (values.length < 2) return 0
  const mid = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, mid)
  const secondHalf = values.slice(mid)
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const a = avg(firstHalf)
  const b = avg(secondHalf)
  if (a === 0) return b > 0 ? 1 : b < 0 ? -1 : 0
  const pctDelta = (b - a) / Math.abs(a)
  if (pctDelta > 0.03) return 1      // >3% move counts as directional
  if (pctDelta < -0.03) return -1
  return 0
}

function changeOf(label: string, values: number[]): SeriesChange | null {
  if (values.length < 2) return null
  const startValue = values[0]
  const endValue = values[values.length - 1]
  const changePct = startValue === 0 ? 0 : Math.round(((endValue - startValue) / Math.abs(startValue)) * 1000) / 10
  const direction = changePct > 1 ? 'rising' : changePct < -1 ? 'falling' : 'flat'
  return { series: label, startValue, endValue, changePct, direction }
}

function valuesFrom(series: Point[] | null | undefined): number[] {
  if (!Array.isArray(series)) return []
  return series.map(p => Number(p.value)).filter(v => Number.isFinite(v))
}

// Detect strong seasonality. Conservative on purpose: only flags series where
// the peak dwarfs the trough (>= 2.5x) AND neither endpoint is the peak (so a
// steadily rising or falling trend is NOT misread as seasonal). Returns the
// seasonal shape when flagged, else null.
function detectSeasonal(demand: MonthlyDemand[]): SeasonalShape | null {
  const pts = demand.filter(d => Number.isFinite(d.value))
  if (pts.length < 6) return null // need enough months to claim seasonality
  let peak = pts[0], trough = pts[0]
  pts.forEach(p => {
    if (p.value > peak.value) peak = p
    if (p.value < trough.value) trough = p
  })
  if (trough.value <= 0) return null
  const ratio = peak.value / trough.value
  if (ratio < 2.5) return null // not a big enough swing to call seasonal

  // Endpoints: if the peak sits at the very start or very end, an endpoint
  // change figure is especially misleading - that is exactly the seasonal case.
  const first = pts[0], last = pts[pts.length - 1]
  const peakIsEndpoint = peak.month === first.month || peak.month === last.month
  const endpointsDiffer = Math.abs(first.value - last.value) / Math.max(first.value, last.value) > 0.25

  // Flag seasonal if there's a big swing and either the peak is at an endpoint
  // or the two endpoints sit on clearly different phases.
  if (peakIsEndpoint || endpointsDiffer) {
    return {
      peakMonth: peak.month,
      troughMonth: trough.month,
      peakValue: peak.value,
      troughValue: trough.value,
      peakToTroughRatio: Math.round(ratio * 10) / 10,
    }
  }
  return null
}

// Macro series come off the econ object; map field -> human label.
const MACRO_LABELS: Record<string, string> = {
  us_consumer_sentiment_index: 'consumer sentiment (University of Michigan)',
  sp500_index_close: 'the S&P 500',
  us_30yr_mortgage_rate_pct: 'the 30-year mortgage rate',
  fed_funds_rate_pct: 'the federal funds rate',
  us_housing_starts: 'housing starts',
  us_building_permits: 'building permits',
  us_disposable_income: 'disposable personal income',
  us_personal_saving_rate_pct: 'the personal saving rate',
  local_unemployment_rate_pct: 'local unemployment',
}

export function analyzeMacro(
  econ: Record<string, Point[] | null> | null,
  gscMonthly: MonthlyDemand[] | null | undefined,
  ga4Monthly: MonthlyDemand[] | null | undefined,
): MacroAnalysis {
  // Pick demand anchor: GSC impressions first, GA4 sessions fallback.
  let demandSource: MacroAnalysis['demandSource'] = 'none'
  let demandMonthly: MonthlyDemand[] = []
  if (Array.isArray(gscMonthly) && gscMonthly.length >= 2) {
    demandSource = 'gsc_impressions'
    demandMonthly = gscMonthly.filter(m => Number.isFinite(m.value))
  } else if (Array.isArray(ga4Monthly) && ga4Monthly.length >= 2) {
    demandSource = 'ga4_sessions'
    demandMonthly = ga4Monthly.filter(m => Number.isFinite(m.value))
  }
  const demandValues = demandMonthly.map(m => Number(m.value))

  const seasonalShape = demandMonthly.length >= 2 ? detectSeasonal(demandMonthly) : null
  const seasonal = seasonalShape != null

  // Endpoint change is only reported when NOT seasonal (it is misleading for
  // a seasonal series). Seasonal demand is characterized by seasonalShape.
  const demandChange = (!seasonal && demandValues.length >= 2)
    ? changeOf(demandSource === 'gsc_impressions' ? 'search demand' : 'web sessions', demandValues)
    : null

  const seriesChanges: SeriesChange[] = []
  const coMovements: CoMovement[] = []
  const demandSign = slopeSign(demandValues)

  if (econ) {
    for (const [field, label] of Object.entries(MACRO_LABELS)) {
      const vals = valuesFrom(econ[field])
      const change = changeOf(label, vals)
      if (change) seriesChanges.push(change)

      // Co-movements are SUPPRESSED when demand is seasonal: correlating a
      // seasonal demand curve against macro trends over one year is not
      // defensible. Economic series still appear via seriesChanges as context.
      if (!seasonal && demandSource !== 'none' && vals.length >= 2 && demandValues.length >= 2) {
        const macroSign = slopeSign(vals)
        let relationship: CoMovement['relationship']
        let note: string
        const demandWord = demandSource === 'gsc_impressions' ? 'search demand' : 'web sessions'
        if (demandSign === 0 || macroSign === 0) {
          relationship = 'unrelated'
          note = `Over the window, ${label} showed no clear directional move relative to ${demandWord}.`
        } else if (demandSign === macroSign) {
          relationship = 'same-direction'
          note = `${demandWord[0].toUpperCase() + demandWord.slice(1)} and ${label} both moved in the same direction over the window.`
        } else {
          relationship = 'inverse'
          note = `${demandWord[0].toUpperCase() + demandWord.slice(1)} moved inversely to ${label} over the window.`
        }
        coMovements.push({ series: label, relationship, note })
      }
    }
  }

  return { demandSource, demandChange, seriesChanges, coMovements, seasonal, seasonalShape }
}
