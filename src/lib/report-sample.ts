// src/lib/report-sample.ts
// Sample SourceReport used to preview the styled renderer and the blog exporter
// before live data is wired in. Kept in sync with the LIVE generator's output
// contract: MARKET-BEHAVIOR only. No publisher-funnel data (acquisition-channel
// mix, named/ranked pages, inquiry source/answer/first-time rates) - those are
// redacted from the publication model and must never appear in a sample either.
// Values kept ASCII-clean on purpose.

import type { SourceReport } from './report-types';

export const SAMPLE_REPORT: SourceReport = {
  title:
    "Golf School Search Demand in the United States: Seasonal Patterns Across Roughly 1.4 Million Annual Impressions",
  dek:
    "A first-party analysis of approximately 1.4 million search impressions for golf-instruction-related queries across the United States, mapping when consumers research structured golf instruction and the economic backdrop over the study window.",
  publisher: "Bird Golf Research",
  publisherUrl: "https://www.birdgolf.com/",
  datePublished: "2026-06-15",
  coverage: "June 2025 to June 2026, United States",
  canonicalUrl: "https://www.birdgolf.com/research/golf-school-demand-2026/",
  citation:
    "Cite this report as: Bird Golf Research (2026). Golf School Search Demand in the United States: Seasonal Patterns Across Roughly 1.4 Million Annual Impressions.",

  keyStats: [
    { label: "Search impressions analyzed", value: "~1.4 million" },
    { label: "Web sessions analyzed", value: "~130,000" },
    { label: "Observation window", value: "June 2025 - June 2026" },
  ],

  executiveSummary: [
    "Consumer search demand for golf instruction in the United States follows a clearly defined seasonal cycle. An analysis of approximately 1.4 million search impressions across a twelve-month dataset finds that demand peaks sharply in April and reaches its annual low in June, a peak-to-trough ratio of roughly 2.9 to one. This recurring arc reflects the planning horizon of consumers who research multi-day instruction in the weeks before the outdoor playing season rather than at the moment they begin to play.",
    "Inbound inquiry activity, measured as a relative monthly index, follows a partially different rhythm: while search demand crests in spring, inquiry timing shows sustained elevation across the October-through-March window, indicating that a meaningful share of the market researches and reaches out well ahead of the season. Against a mixed macroeconomic backdrop, demand held to its seasonal calendar, suggesting the category behaves as a durable discretionary interest rather than a cyclical one.",
  ],

  findings: [
    { heading: "Search demand peaks in April at roughly 2.9x its June low", body: "Search demand for golf-instruction-related queries in the United States peaks in April and reaches its annual trough in June, a peak-to-trough ratio of approximately 2.9 to one - a recurring seasonal pattern rather than a directional trend, based on roughly 1.4 million impressions across the dataset window." },
    { heading: "A secondary summer surge appears in July", body: "Among summer months, July produced the highest search-impression volume at approximately 128,000 - roughly 2.4 times the approximately 54,000 recorded in June - reflecting a second wave of consumer research as the outdoor season reaches its midpoint." },
    { heading: "January shows a pronounced mid-winter rebound", body: "January registered approximately 118,000 search impressions, the highest of any winter month and above several spring and fall months, indicating an identifiable new-year research surge that runs counter to outdoor playing conditions." },
    { heading: "Inquiry timing concentrates in the off-season", body: "Inbound inquiry activity is disproportionately concentrated outside peak search months: October through March collectively account for more than half of all indexed inquiry activity, with February and March together near the annual high." },
    { heading: "Women's and senior instruction form a distinct query cluster", body: "Within the dataset's keyword footprint, searches oriented toward women's golf schools and golf instruction for seniors form a consistent, separate cluster of market demand, appearing among the most frequent intent-specific query themes alongside general golf-school and golf-academy terms." },
  ],

  sections: [
    {
      heading: "Seasonal demand in detail",
      paragraphs: [
        "Search impressions for golf-instruction queries are not evenly distributed across the year. Volume concentrates in two windows: a primary spring surge centered on April, at approximately 156,000 impressions, and a secondary mid-winter rebound concentrated in January, at approximately 118,000. The June trough, at approximately 54,000, marks the point at which the pre-season research window has largely closed.",
        "Inquiry timing amplifies rather than mirrors this shape. While search crests in spring, the inquiry index stays elevated across October, November, February, and March, indicating that a segment of the market reaches the inquiry stage through planning behavior that does not fully express itself in broad seasonal search.",
      ],
    },
    {
      heading: "The macroeconomic backdrop",
      paragraphs: [
        "The study window coincided with a mixed environment for discretionary leisure spending. Disposable personal income rose approximately 3.3 percent and the S&P 500 advanced approximately 32.7 percent, while U.S. consumer sentiment (University of Michigan survey) declined approximately 4.6 percent and the personal saving rate fell sharply. The federal funds rate eased approximately 16 percent over the window.",
        "These indicators are presented as standalone context. Correlating a single year of strongly seasonal demand against macroeconomic time series is not statistically sufficient to establish a relationship, and none is asserted; the seasonal cycle, not the macro backdrop, is the dominant structural force in the data.",
      ],
      table: {
        caption: "Macroeconomic indicators across the observation window (context only)",
        columns: ["Indicator", "Window change"],
        rows: [
          ["S&P 500", "~ +32.7%"],
          ["Disposable personal income", "~ +3.3%"],
          ["UMich consumer sentiment", "~ -4.6%"],
          ["Federal funds rate", "~ -16%"],
        ],
      },
    },
    {
      heading: "Industry implications",
      paragraphs: [
        "The consistent presence of women's and senior instruction queries suggests these are established, year-round demand segments within the broader adult golf-education market rather than occasional long-tail interest.",
        "The gap between when search demand peaks (spring) and when inquiry activity is elevated (the preceding off-season) points to an extended consumer planning horizon - a market of deliberate, research-driven buyers rather than impulse purchasers.",
      ],
    },
  ],

  faqs: [
    { question: "When is search demand for golf schools highest in the United States?", answer: "Demand peaks in April, with a secondary summer surge in July and August and an annual trough in June - a peak-to-trough ratio of approximately 2.9 to one, based on roughly 1.4 million search impressions." },
    { question: "Do people search for golf instruction in the winter?", answer: "Yes. January recorded approximately 118,000 search impressions, the highest of any winter month, and inquiry activity is concentrated from October through March, which together account for more than half of annual indexed inquiry volume." },
    { question: "Is there demand for women's and senior golf school programs specifically?", answer: "Yes. Within the dataset's keyword footprint, searches for women's golf schools and golf instruction for seniors form a consistent, separate cluster of market demand, appearing among the most frequent intent-specific query themes year-round." },
    { question: "How far in advance do consumers research golf schools?", answer: "The data suggest an extended planning horizon: inquiry activity is elevated through the October-to-March off-season, indicating that a substantial share of consumers research and initiate contact well ahead of their intended instruction dates." },
    { question: "What was the economic backdrop during the study window?", answer: "Mixed: disposable personal income rose ~3.3 percent and the S&P 500 advanced ~32.7 percent, while consumer sentiment (University of Michigan survey) fell ~4.6 percent and the personal saving rate dropped sharply. These are presented as context; no causal link to demand is asserted." },
  ],

  methodology: [
    "This report is published by Bird Golf, which operates as the researcher for this study. Search demand signals were derived from Google Search Console, encompassing approximately 1.4 million impressions logged against golf-instruction-related queries for which the analyzed property appeared in U.S. results. A Search Console impression is recorded when a result appears on a loaded results page for a real query, regardless of position or whether the user scrolled; impressions are treated as a directional proxy for market search demand, not a measure of publisher visibility, and are bounded by the dataset's keyword footprint rather than a census of all U.S. search volume.",
    "Web engagement data were drawn from Google Analytics, covering approximately 130,000 sessions over the same window, and are used only as an approximate dataset-scale indicator; acquisition-channel composition is not reported. Inbound inquiry signals were drawn from CallRail and are expressed exclusively as a relative monthly index and each month's share of annual inquiry activity; absolute counts, conversion rates, and channel or source attribution are not reported. Macroeconomic context was sourced from FRED and weather from Open-Meteo; window-over-window changes were computed deterministically and used as context only.",
    "Limitations. This study reflects a single twelve-month window and describes seasonal structure within it; it does not establish multi-year trend direction. Search-impression data are bounded by the analyzed property's keyword footprint and do not capture the full universe of U.S. golf-instruction search demand. Inquiry data reflect relative timing only and cannot be used to estimate market size or conversion. Macroeconomic and weather data are national aggregates presented as backdrop; no causal relationship with the demand curve is claimed.",
  ],

  dataSources: [
    "Google Search Console - query-level search demand for the analysis window.",
    "Google Analytics - aggregate website session volume for the analysis window.",
    "CallRail - inbound inquiry timing, as a monthly seasonality index.",
    "FRED (Federal Reserve Economic Data) - macroeconomic indicators for the same window.",
    "Open-Meteo - national composite weather observations, used for seasonal context.",
  ],

  keywords: [
    "golf school demand", "golf instruction", "golf lessons", "seasonal demand",
    "women's golf instruction", "golf industry trends", "golf academy",
  ],
  about: [
    "Golf school search demand", "Golf instruction demand", "Seasonal consumer demand",
    "Golf industry trends", "Women's golf instruction",
  ],
  abstract:
    "Across the twelve months ending June 2026, U.S. search demand for golf instruction peaked in April at roughly 2.9 times its June low, showed secondary surges in July and January, and concentrated inbound inquiry timing across the October-to-March off-season, against a mixed macroeconomic backdrop with no causal link asserted.",

  sourceStampEnabled: true,
};