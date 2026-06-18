// src/lib/report-chart.ts
// Pure, deterministic SVG line-chart generator for SOURCE reports.
// No chart library, no external fonts, no scripts - returns a self-contained
// SVG string snapshotted into the report at generation time. Brand-neutral
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
}

// Format "2026-04" -> "Apr 26"; pass through anything that does not match.
function shortMonth(m: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(m);
  if (!match) return m;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const yr = match[1].slice(2);
  const idx = Number(match[2]) - 1;
  return (months[idx] || match[2]) + ' ' + yr;
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

// Returns null when there is not enough data to draw a meaningful chart.
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

  // Cap visible x-axis labels so long (e.g. 24-month) series do not collide.
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
