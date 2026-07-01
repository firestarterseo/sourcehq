// src/lib/derivative-prompts.ts
// Prompt builders for client-facing "spin off" derivative content, generated
// from an already-published SourceReport. Every platform pulls only from the
// redacted SourceReport object the canonical report uses - no funnel data
// (GSC top pages, GA4 channels, CallRail sources) exists on that type, so the
// redaction boundary holds here the same way it does for the report itself.

import type { SourceReport } from './report-types'

export type DerivativePlatform = 'linkedin' | 'reddit' | 'medium' | 'pr_wire'

export const PLATFORM_LABELS: Record<DerivativePlatform, string> = {
  linkedin: 'LinkedIn Article',
  reddit: 'Reddit Post',
  medium: 'Medium Article',
  pr_wire: 'Press Release',
}

function reportContext(report: SourceReport): string {
  const canonicalUrl = report.canonicalUrl || report.publisherUrl || ''
  const topFindings = (report.findings || []).slice(0, 3)
    .map(f => '- ' + (f.heading ? f.heading + ': ' : '') + f.body)
    .join('\n')
  const macroLine = report.macro && report.macro.seasonal && report.macro.seasonalShape
    ? 'Seasonal pattern: peaks in ' + report.macro.seasonalShape.peakMonth + ', troughs in ' + report.macro.seasonalShape.troughMonth + ', a ' + report.macro.seasonalShape.peakToTroughRatio + 'x peak-to-trough ratio.'
    : (report.macro && report.macro.seriesChanges && report.macro.seriesChanges[0]
        ? 'Economic context: ' + report.macro.seriesChanges[0].series + ' moved ' + report.macro.seriesChanges[0].changePct + '% over the window.'
        : '')
  const keyStatsLine = (report.keyStats || []).map(s => s.label + ': ' + s.value).join('; ')

  return [
    'SOURCE REPORT (do not invent data, do not alter any number, use only what is below):',
    'Title: ' + report.title,
    'Dek: ' + report.dek,
    'Publisher: ' + report.publisher,
    'Published: ' + report.datePublished,
    'Coverage: ' + report.coverage,
    'Canonical URL: ' + (canonicalUrl || '(not yet published - reference "the full report" without a URL)'),
    'Citation line: ' + report.citation,
    'Key stats: ' + keyStatsLine,
    'Abstract: ' + report.abstract,
    'Top findings:',
    topFindings,
    macroLine,
  ].join('\n')
}

function commonRules(publisher: string): string {
  return [
    'RULES THAT APPLY REGARDLESS OF PLATFORM:',
    '- Never invent, round further, or alter any statistic from the source report above. Use the exact figures given.',
    '- Always attribute the data to ' + publisher + ' as the publisher/researcher.',
    '- Never omit the dataset scale, geography, or time window somewhere in the piece.',
    '- Do not use hedging language on data findings ("our data shows X" beats "it appears X may be").',
    '- Respond with ONLY valid JSON, no markdown fences.',
  ].join('\n')
}

export function buildDerivativePrompt(platform: DerivativePlatform, report: SourceReport): string {
  const ctx = reportContext(report)
  const rules = commonRules(report.publisher)

  if (platform === 'linkedin') {
    return 'You are a content strategist rewriting a market research report as a LinkedIn Article. Do not republish the report verbatim - reframe with a different narrative angle and LinkedIn-native structure.\n\n'
      + ctx + '\n\n'
      + 'FORMAT SPEC:\n'
      + '- Length: 600-900 words.\n'
      + '- Headline: a finding-first or counterintuitive claim (not the report title). Lead with the most surprising number.\n'
      + '- Opening hook (no header): 2-3 sentences, no preamble, state the most counterintuitive finding immediately.\n'
      + '- Context paragraph: 2-3 sentences on what was studied (dataset size, window, geography).\n'
      + '- One section per top finding (use a short header for each), each opening with a standalone claim sentence containing the key statistic.\n'
      + '- Implication paragraph: 3-4 sentences, written for a business owner, not an SEO/industry professional.\n'
      + '- Closing line: one sentence pointing to the full report.\n'
      + '- Short paragraphs (max 3 sentences). Bold key statistics inline using **markdown**. No bullet lists longer than 4 items. No tables.\n'
      + '- Do not reuse the report\u0027s exact title or opening paragraph.\n'
      + '- End with a "Source: ' + report.publisher + ' - full report at [link]" style attribution line.\n\n'
      + rules + '\n\n'
      + 'JSON shape:\n{ "title": "string - the LinkedIn headline", "body": "string - full article body in markdown, including headers" }'
  }

  if (platform === 'reddit') {
    return 'You are writing a genuine, non-promotional Reddit post sharing findings from original research. Reddit aggressively filters promotional content - this must read as a community contribution, not marketing.\n\n'
      + ctx + '\n\n'
      + 'FORMAT SPEC:\n'
      + '- Post body: 300-500 words, prose only, no headers, no bullet lists.\n'
      + '- Structure: (1) "What we did" - 2 sentences, dataset size/window/geography, no promotion. (2) Most surprising finding, leading with the most counterintuitive number. (3) Two to three more findings as short conversational paragraphs with exact numbers. (4) One genuine question inviting community discussion. (5) Link placement line at the very end: "Full data and methodology here: [link]".\n'
      + '- Conversational first-person voice ("we found," "our data showed"). Bold only the single most important statistic.\n'
      + '- Do not name the publisher in the title. Name it once in the body.\n'
      + '- Also write a top comment (150-250 words) expanding on the most actionable finding for a business owner, including one additional stat from the report not featured in the main post.\n'
      + '- Suggest 3-5 subreddits this would fit, relevant to this report\u0027s actual industry and geography.\n\n'
      + rules + '\n\n'
      + 'JSON shape:\n{ "title": "string - post title, a complete specific claim, publisher name NOT in the title", "body": "string - the post body", "topComment": "string - the top comment", "subredditSuggestions": ["string", "..."] }'
  }

  if (platform === 'medium') {
    return 'You are rewriting a market research report as a Medium article for syndication. This must be a rewrite, not a verbatim copy, with narrative/storytelling framing appropriate to Medium\u0027s editorial tone.\n\n'
      + ctx + '\n\n'
      + 'FORMAT SPEC:\n'
      + '- Length: 1,200-1,800 words.\n'
      + '- Headline: storytelling-style, different from the report\u0027s own title.\n'
      + '- Subtitle: one sentence summarizing the key finding.\n'
      + '- Opening narrative: 2-3 paragraphs on why this data was collected and what question it answers - more narrative than a research report.\n'
      + '- Data section: present the findings with full statistics, framed in fresh prose (not copied from the report).\n'
      + '- Context section: the macroeconomic/seasonal backdrop, for citeable depth.\n'
      + '- Implications section: written for a broad business audience.\n'
      + '- Required closing line, verbatim: "This article is based on original research published by ' + report.publisher + '. Full report, methodology, and data: [link]"\n'
      + '- Use H2 subheadings per section (as markdown ##). Include one pull quote per major finding as a standalone blockquote line containing a statistic. Short paragraphs (2-3 sentences). First-person ("we analyzed") is appropriate.\n\n'
      + rules + '\n\n'
      + 'JSON shape:\n{ "title": "string", "subtitle": "string", "body": "string - full article in markdown including ## headers and > pull quotes", "tags": ["string", "5-6 relevant tags"] }'
  }

  return 'You are writing a press release in strict inverted-pyramid journalism style, third person throughout, based on a market research report.\n\n'
    + ctx + '\n\n'
    + 'FORMAT SPEC:\n'
    + '- Length: 400-600 words.\n'
    + '- Headline: newswire format "[Publisher] Releases Study Showing [specific finding]" - must include the key statistic.\n'
    + '- Dateline line (city, date - use the report\u0027s coverage geography and published date).\n'
    + '- Lead paragraph: who/what/when/where/why in 2-3 sentences - the study, the publisher, dataset size, and the single most important finding.\n'
    + '- One body paragraph per top finding, exact statistics.\n'
    + '- One executive quote, 2-3 sentences, attributed to "a spokesperson for ' + report.publisher + '" - must add interpretation, not just restate the data.\n'
    + '- Short "About ' + report.publisher + '" boilerplate, 2-3 sentences.\n'
    + '- Closing line: "Full report available at: [link]"\n'
    + '- Third person throughout. No bullet lists. All statistics as numerals. No superlatives ("most comprehensive study ever"). No calls to action for services.\n\n'
    + rules + '\n\n'
    + 'JSON shape:\n{ "title": "string - the headline", "body": "string - full press release including dateline, third person, quote, boilerplate" }'
}
