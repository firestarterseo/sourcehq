// src/lib/report-chart.ts
// Pure, deterministic SVG chart generators for SOURCE reports.
// No chart library, no external fonts, no scripts - returns self-contained
// SVG strings snapshotted into the report at generation time. Brand-neutral
// styling is baked in so it does not fight the host site theme on export.

export interface ChartPoint {
  month: string;   // "2026-04" or any short label
  value: number;
}

export interface ChartSpec {
  title: string;
  unitLabel: string;       // e.g. "Search impressions"
  points: ChartPoint[];
}

export interface ReportChart {
  title: string;
  unitLabel: string;
  svg: string;             // self-contained SVG markup
  points: ChartPoint[];    // kept so the export can render an adjacent data table
  caption?: string;        // liftable, deterministic claim shown as the figcaption
}

// Multi-series indexed comparison chart.
export interface ComparisonSeries {
  label: string;
  monthly: ChartPoint[];   // monthly { month, value } points (raw values)
  anchor?: boolean;        // true for the bold first-party demand line
}

export interface ComparisonChart {
  title: string;
  svg: string;
  // Tidy data for the adjacent table: rows of month + each series' indexed value.
  seriesLabels: string[];
  rows: { month: string; values: (number | null)[] }[];
}

// Format "2026-04" -> "Apr 26"; pass through anything that does not match.
function shortMonth(m: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(m);
  if (!match) return m;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (months[Number(match[2]) - 1] || match[2]) + ' ' + match[1].slice(2);
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function fmtAxis(n: number): string {
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10) + 'M';
  if (n >= 1_000) return (Math.round(n / 100) / 10) + 'k';
  return String(Math.round(n));
}

// --- Single-series line chart (search demand by month) ----------------------

export function buildLineChart(spec: ChartSpec): ReportChart | null {
  const points = (spec.points || []).filter(p => Number.isFinite(p.value));
  if (points.length < 2) return null;
  if (points.every(p => p.value === 0)) return null;

  const W = 720, H = 300;
  const padL = 52, padR = 18, padT = 18, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = niceCeil(Math.max(...points.map(p => p.value)));
  const n = points.length;

  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const maxLabels = 12;
  const labelStep = Math.ceil(n / maxLabels);

  const axis = '#cbd0d6';
  const grid = '#eceef1';
  const ink = '#3b3f46';
  const accent = '#1F4D3A';

  const gridLines: string[] = [];
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const val = (maxVal / ticks) * t;
    const gy = y(val);
    gridLines.push(`<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" stroke="${grid}" stroke-width="1"/>`);
    gridLines.push(`<text x="${padL - 8}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${ink}" font-family="system-ui,sans-serif">${fmtAxis(val)}</text>`);
  }

  const xLabels: string[] = [];
  points.forEach((p, i) => {
    if (i % labelStep === 0 || i === n - 1) {
      xLabels.push(`<text x="${x(i).toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" font-size="11" fill="${ink}" font-family="system-ui,sans-serif">${shortMonth(p.month)}</text>`);
    }
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.5" fill="${accent}"/>`).join('');

  const svg =
`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${spec.title.replace(/"/g, '')}" style="max-width:100%;height:auto;">
  <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
  ${gridLines.join('\n  ')}
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="${axis}" stroke-width="1"/>
  <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${axis}" stroke-width="1"/>
  <path d="${areaPath}" fill="${accent}" fill-opacity="0.08"/>
  <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  ${xLabels.join('\n  ')}
  <text x="${padL}" y="12" font-size="11" fill="${ink}" font-family="system-ui,sans-serif">${spec.unitLabel.replace(/</g, '')}</text>
</svg>`;

  return { title: spec.title, unitLabel: spec.unitLabel, svg, points };
}

// --- Multi-series indexed comparison chart ----------------------------------
// Aligns every series to a shared month axis and indexes each to 100 at its
// first available month, so series on wildly different scales (impressions,
// sentiment ~50, S&P ~6500) become visually comparable. Shows relative
// movement, which is the honest comparison.

export function buildComparisonChart(title: string, series: ComparisonSeries[]): ComparisonChart | null {
  const usable = series.filter(s => Array.isArray(s.monthly) && s.monthly.length >= 2);
  if (usable.length < 2) return null; // need the anchor + at least one comparison

  // Shared month axis is bounded to the ANCHOR (demand) series' window, so
  // economic series that extend earlier/later than demand do not drag in
  // months where demand is null (which would render as a phantom 0 and squash
  // the indexed scale). Falls back to the union if no anchor is flagged.
  const anchor = usable.find(s => s.anchor) || usable[0];
  const anchorMonths = anchor.monthly
    .filter(p => Number.isFinite(p.value))
    .map(p => p.month)
    .sort();
  if (anchorMonths.length < 2) return null;
  const minMonth = anchorMonths[0];
  const maxMonth = anchorMonths[anchorMonths.length - 1];
  const monthSet = new Set<string>();
  usable.forEach(s => s.monthly.forEach(p => {
    if (Number.isFinite(p.value) && p.month >= minMonth && p.month <= maxMonth) monthSet.add(p.month);
  }));
  const months = Array.from(monthSet).sort();
  if (months.length < 2) return null;

  // Index each series to 100 at its first non-null month on the shared axis.
  type Indexed = { label: string; anchor: boolean; idx: (number | null)[] };
  const indexed: Indexed[] = usable.map(s => {
    const byMonth: Record<string, number> = {};
    s.monthly.forEach(p => { if (Number.isFinite(p.value)) byMonth[p.month] = p.value; });
    const aligned = months.map(m => (m in byMonth ? byMonth[m] : null));
    const base = aligned.find(v => v != null && v !== 0) ?? null;
    const idx = aligned.map(v => (v == null || base == null) ? null : Math.round((v / base) * 1000) / 10);
    return { label: s.label, anchor: !!s.anchor, idx };
  });

  // Y range across all indexed values.
  const allVals = indexed.flatMap(s => s.idx.filter((v): v is number => v != null));
  if (!allVals.length) return null;
  const minV = Math.min(100, ...allVals);
  const maxV = Math.max(100, ...allVals);
  const padTop = (maxV - minV) * 0.1 || 10;
  const yMin = Math.max(0, Math.floor((minV - padTop) / 10) * 10); // indexed values are never negative
  const yMax = Math.ceil((maxV + padTop) / 10) * 10;

  const W = 720, H = 340;
  const padL = 46, padR = 18, padT = 18, padB = 64; // extra bottom pad for legend
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = months.length;

  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const axis = '#cbd0d6';
  const grid = '#eceef1';
  const ink = '#3b3f46';
  const accent = '#1F4D3A';
  // Neutral greys for comparison lines, varying weight; anchor uses accent.
  const greys = ['#8a9099', '#aeb3ba', '#c7ccd2'];

  const gridLines: string[] = [];
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const val = yMin + ((yMax - yMin) / ticks) * t;
    const gy = y(val);
    gridLines.push(`<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" stroke="${grid}" stroke-width="1"/>`);
    gridLines.push(`<text x="${padL - 8}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${ink}" font-family="system-ui,sans-serif">${Math.round(val)}</text>`);
  }
  // Emphasize the 100 baseline.
  const baseY = y(100);
  gridLines.push(`<line x1="${padL}" y1="${baseY.toFixed(1)}" x2="${W - padR}" y2="${baseY.toFixed(1)}" stroke="#9aa0a8" stroke-width="1" stroke-dasharray="3 3"/>`);

  const maxLabels = 12;
  const labelStep = Math.ceil(n / maxLabels);
  const xLabels: string[] = [];
  months.forEach((m, i) => {
    if (i % labelStep === 0 || i === n - 1) {
      xLabels.push(`<text x="${x(i).toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" font-size="11" fill="${ink}" font-family="system-ui,sans-serif">${shortMonth(m)}</text>`);
    }
  });

  // Draw comparison lines first (so the anchor sits on top), then anchor.
  const ordered = [...indexed].sort((a, b) => (a.anchor === b.anchor ? 0 : a.anchor ? 1 : -1));
  let greyIdx = 0;
  const linePaths: string[] = [];
  ordered.forEach(s => {
    const color = s.anchor ? accent : greys[Math.min(greyIdx++, greys.length - 1)];
    const width = s.anchor ? 2.5 : 1.5;
    let d = '';
    let started = false;
    s.idx.forEach((v, i) => {
      if (v == null) { started = false; return; }
      d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      started = true;
    });
    if (d) linePaths.push(`<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`);
  });

  // Legend along the bottom.
  greyIdx = 0;
  const legendItems = ordered.map(s => {
    const color = s.anchor ? accent : greys[Math.min(greyIdx++, greys.length - 1)];
    return { label: s.label, color, anchor: s.anchor };
  });
  let lx = padL;
  const ly = H - 14;
  const legend: string[] = [];
  legendItems.forEach(it => {
    legend.push(`<line x1="${lx}" y1="${ly - 4}" x2="${lx + 16}" y2="${ly - 4}" stroke="${it.color}" stroke-width="${it.anchor ? 2.5 : 1.5}"/>`);
    legend.push(`<text x="${lx + 21}" y="${ly}" font-size="11" fill="${ink}" font-family="system-ui,sans-serif">${it.label.replace(/</g, '')}</text>`);
    lx += 21 + it.label.length * 6.2 + 18;
  });

  const svg =
`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title.replace(/"/g, '')}" style="max-width:100%;height:auto;">
  <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
  ${gridLines.join('\n  ')}
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="${axis}" stroke-width="1"/>
  <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${axis}" stroke-width="1"/>
  ${linePaths.join('\n  ')}
  ${xLabels.join('\n  ')}
  ${legend.join('\n  ')}
  <text x="${padL}" y="12" font-size="11" fill="${ink}" font-family="system-ui,sans-serif">Indexed to 100 at window start</text>
</svg>`;

  const rows = months.map((m, i) => ({ month: m, values: indexed.map(s => s.idx[i]) }));
  return { title, svg, seriesLabels: indexed.map(s => s.label), rows };
}


