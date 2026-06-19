// src/lib/report-export.ts
// Pure, framework-agnostic renderers that turn a SourceReport into the two
// blog-publishing artifacts: a paste-safe semantic HTML fragment (no CSS,
// no classes - inherits the host theme) and a JSON-LD schema object that
// lives in the site schema/header plugin, never in the post body.
//
// Charts are the one exception to the no-styling rule: an SVG must carry its
// own minimal, brand-neutral styling to render at all. Each chart is followed
// by a data table so the figures stay machine-readable for LLMs and survive
// editors that strip SVG.

import type { SourceReport, ReportTable } from './report-types';
import type { ReportChart } from './report-chart';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderTable(t: ReportTable): string {
  const head = '<tr>' + t.columns.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr>';
  const body = t.rows
    .map((r) => '<tr>' + r.map((cell) => `<td>${esc(cell)}</td>`).join('') + '</tr>')
    .join('\n    ');
  const caption = t.caption ? `\n  <caption>${esc(t.caption)}</caption>` : '';
  return `<table>${caption}\n  <thead>${head}</thead>\n  <tbody>\n    ${body}\n  </tbody>\n</table>`;
}

function shortMonth(m: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(m);
  if (!match) return m;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (months[Number(match[2]) - 1] || match[2]) + ' ' + match[1].slice(2);
}

function renderCharts(charts: ReportChart[]): string {
  return charts
    .map((ch) => {
      const rows = ch.points
        .map((p) => `    <tr><td>${esc(shortMonth(p.month))}</td><td>${esc(String(p.value))}</td></tr>`)
        .join('\n');
      const table =
        `<table>\n  <caption>${esc(ch.title)} - data</caption>\n  <thead><tr><th>Month</th><th>${esc(ch.unitLabel)}</th></tr></thead>\n  <tbody>\n${rows}\n  </tbody>\n</table>`;
      // figure groups the SVG, its caption, AND the data table so the numbers
      // are always machine-readable in the export. The in-app preview hides the
      // in-figure table via CSS (.srcv figure table{display:none}) for a clean
      // on-screen chart, while the exported HTML keeps it for LLMs.
      return `<figure>\n${ch.svg}\n<figcaption>${esc(ch.caption || ch.title)}</figcaption>\n${table}\n</figure>`;
    })
    .join('\n\n');
}

export function renderContentHtml(report: SourceReport): string {
  const parts: string[] = [];

  parts.push(
    `<!-- ${esc(report.publisher)} - CONTENT FILE (paste into the blog body). ` +
      `No CSS or classes by design: it inherits the host theme on WordPress, Wix, etc. ` +
      `Add the matching schema (separate JSON) via your SEO/schema or header-script plugin. ` +
      `If your CMS sets the post title separately, use the h1 as the title and remove it here. -->`
  );

  parts.push(`<h1>${esc(report.title)}</h1>`);
  parts.push(`<p>${esc(report.dek)}</p>`);
  parts.push(
    `<p><strong>Publisher:</strong> ${esc(report.publisher)} &nbsp;&middot;&nbsp; ` +
      `<strong>Published:</strong> ${esc(report.datePublished)} &nbsp;&middot;&nbsp; ` +
      `<strong>Coverage:</strong> ${esc(report.coverage)}</p>`
  );
  parts.push(`<blockquote><p>${esc(report.citation)}</p></blockquote>`);

  if (report.keyStats && report.keyStats.length) {
    const rows = report.keyStats
      .map((s) => `    <tr><td>${esc(s.label)}</td><td>${esc(s.value)}</td></tr>`)
      .join('\n');
    parts.push(
      `<h2>Key statistics</h2>\n<table>\n  <thead><tr><th>Metric</th><th>Value</th></tr></thead>\n  <tbody>\n${rows}\n  </tbody>\n</table>`
    );
  }

  if (report.executiveSummary && report.executiveSummary.length) {
    parts.push('<h2>Executive summary</h2>');
    report.executiveSummary.forEach((p) => parts.push(`<p>${esc(p)}</p>`));
  }

  // Lead visual: chart(s) right after the summary, before the detailed findings.
  if (report.charts && report.charts.length) {
    parts.push(renderCharts(report.charts));
  }

  if (report.findings && report.findings.length) {
    parts.push('<h2>Findings</h2>');
    report.findings.forEach((f) => {
      parts.push(`<h3>${esc(f.heading)}</h3>`);
      parts.push(`<p>${esc(f.body)}</p>`);
    });
  }

  if (report.sections && report.sections.length) {
    report.sections.forEach((sec) => {
      parts.push(`<h2>${esc(sec.heading)}</h2>`);
      sec.paragraphs.forEach((p) => parts.push(`<p>${esc(p)}</p>`));
      if (sec.table) parts.push(renderTable(sec.table));
    });
  }

  if (report.faqs && report.faqs.length) {
    parts.push('<h2>Frequently asked questions</h2>');
    report.faqs.forEach((q) => {
      parts.push(`<h3>${esc(q.question)}</h3>`);
      parts.push(`<p>${esc(q.answer)}</p>`);
    });
  }

  if (report.methodology && report.methodology.length) {
    parts.push('<h2>Methodology</h2>');
    report.methodology.forEach((p) => parts.push(`<p>${esc(p)}</p>`));
  }

  if (report.dataSources && report.dataSources.length) {
    const items = report.dataSources.map((d) => `  <li>${esc(d)}</li>`).join('\n');
    parts.push(`<h2>Data sources</h2>\n<ul>\n${items}\n</ul>`);
  }

  parts.push('<hr>');
  // Published asset stays neutral: no agency-method branding on the client's
  // domain, where it would undercut the third-party-research framing. The
  // SOURCE stamp remains on the in-app preview/PDF (SourceReportView.tsx).
  parts.push(
    `<p><em>Published by ${esc(report.publisher)}. Free to cite with attribution.</em></p>`
  );

  return parts.join('\n\n') + '\n';
}

export function buildSchema(report: SourceReport): Record<string, unknown> {
  const orgId = (report.publisherUrl || 'https://example.com/') + '#org';
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': orgId,
      name: report.publisher,
      url: report.publisherUrl || undefined,
    },
    {
      '@type': 'Report',
      headline: report.title,
      datePublished: report.datePublished,
      inLanguage: 'en-US',
      url: report.canonicalUrl || undefined,
      keywords: report.keywords && report.keywords.length ? report.keywords.join(', ') : undefined,
      about: report.about && report.about.length ? report.about : undefined,
      author: { '@type': 'Organization', name: report.publisher },
      publisher: { '@id': orgId },
      isAccessibleForFree: true,
      abstract: report.abstract || undefined,
      citation: report.citation,
    },
  ];

  if (report.faqs && report.faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: report.faqs.map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: { '@type': 'Answer', text: q.answer },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

export function renderSchemaJson(report: SourceReport): string {
  return JSON.stringify(buildSchema(report), null, 2);
}

export function renderSchemaScriptTag(report: SourceReport): string {
  return '<script type="application/ld+json">\n' + renderSchemaJson(report) + '\n</script>';
}

