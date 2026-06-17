// src/lib/report-sample.ts
// Sample SourceReport used to preview the styled renderer and the blog exporter
// before live data is wired in. Values kept ASCII-clean on purpose.

import type { SourceReport } from './report-types';

export const SAMPLE_REPORT: SourceReport = {
  title:
    "Golf School Enrollment Demand in the United States: Seasonal Patterns, Consumer Behavior, and Market Signals, 2025-2026",
  dek:
    "A first-party analysis of several hundred thousand web sessions and national inbound inquiries across the 13 months ending June 2026, examining when, how, and under what economic conditions U.S. consumers seek structured golf instruction.",
  publisher: "Bird Golf Research",
  publisherUrl: "https://www.birdgolf.com/",
  datePublished: "2026-06-15",
  coverage: "June 2025 to June 2026, United States",
  canonicalUrl: "https://www.birdgolf.com/research/golf-school-demand-2026/",
  citation:
    "Cite this report as: Bird Golf Research (2026). Golf School Enrollment Demand in the United States: Seasonal Patterns, Consumer Behavior, and Market Signals, 2025-2026.",

  keyStats: [
    { label: "Peak demand month (January 2026)", value: "~15,600 sessions" },
    { label: "January demand vs. seasonal low", value: "~4x" },
    { label: "Strongest two-month window (Mar-Apr 2026)", value: "~28,600 sessions" },
    { label: "Seasonal low (Jun 2025 / Jun 2026)", value: "~3,900 / ~5,600" },
    { label: "Inbound inquiries answered", value: "~96%" },
    { label: "Inquiries from first-time callers", value: "~82%" },
    { label: "Phone inquiries via Google Ads", value: "~96%" },
    { label: "Web traffic mix (organic / paid search / paid social)", value: "26% / 21% / 20%" },
    { label: "Women's instruction content rank", value: "Top 5 (~4,000 sessions)" },
    { label: "Consumer sentiment (Jul 2025 to Apr 2026)", value: "61.7 to 49.8 (-11.9)" },
    { label: "S&P 500 change over window", value: "~ +24%" },
  ],

  executiveSummary: [
    "Demand for structured golf instruction in the United States is defined by strong winter-to-spring demand surges, near-total reliance on paid search as the primary inquiry driver, and a meaningful and growing women's golf instruction segment. Web traffic peaked in January and April 2026, with January generating the highest single-month session volume in the study.",
    "Against a backdrop of compressed consumer sentiment and unemployment hovering near 4.3 to 4.4 percent through most of the window, demand for structured golf instruction remained broadly stable, suggesting the category retains resilience among its target audience and behaves as a durable discretionary purchase rather than a cyclical one.",
  ],

  findings: [
    { heading: "January is the demand peak", body: "January 2026 was the single highest-traffic month in the 13-month study, generating approximately 15,600 web sessions, roughly four times the volume recorded at the June 2025 seasonal low." },
    { heading: "High-intent activity concentrates across December to April", body: "March and April 2026 together generated approximately 28,600 web sessions, the strongest back-to-back two-month performance in the study, aligning with the pre-season period when golfers in northern climates begin scheduling instruction." },
    { heading: "Discovery and inquiry funnels diverge sharply", body: "Web discovery is distributed across organic search (~26%), paid search (~21%), and paid social (~20%) with no dominant source. Phone inquiries, by contrast, were heavily concentrated: approximately 96% came from Google Ads. Discovery is diversified; conversion to inquiry is not." },
    { heading: "Inquiry quality is exceptionally high", body: "Approximately 96% of recorded inquiries were answered, and an estimated 82% originated from first-time contacts, indicating a market characterized by new-customer acquisition rather than repeat engagement." },
    { heading: "Women's instruction is a distinct, underserved segment", body: "Dedicated women's golf school content ranked among the top five most-visited content areas (~4,000 sessions), ahead of destination pages for Palm Springs, New Jersey, and Orlando." },
    { heading: "Gifting is a measurable, recurring demand signal", body: "Gift-certificate content appeared among the top 15 most-visited pages (~2,000 sessions), aligned with the November to January holiday period." },
  ],

  sections: [
    {
      heading: "Seasonal demand in detail",
      paragraphs: [
        "Web sessions rose from a June 2025 low of approximately 3,900 to the January 2026 peak of approximately 15,600, then sustained elevated volume through the March-April pre-season window before easing again toward a June 2026 reading of approximately 5,600.",
        "A notable mid-summer divergence appears between browsing and intent. While July 2025 represented the peak inquiry month, August 2025 saw inquiry share decline approximately 36% from that peak even as web sessions remained above 9,400.",
      ],
    },
    {
      heading: "The macroeconomic backdrop",
      paragraphs: [
        "Demand held stable across a divergent macro environment. The S&P 500 rose approximately 24% over the window while University of Michigan consumer sentiment fell 11.9 points, from 61.7 in July 2025 to 49.8 in April 2026. The federal funds rate eased from 4.33% to approximately 3.63%, and unemployment held near 4.3 to 4.4 percent throughout.",
        "That rising equities and falling sentiment moved in opposite directions while golf school demand tracked its seasonal calendar reinforces the category's apparent resilience. All relationships are coincident or contextual; no causation is asserted.",
      ],
      table: {
        caption: "Macroeconomic indicators across the observation window",
        columns: ["Indicator", "Start", "End / low", "Move"],
        rows: [
          ["S&P 500 (monthly)", "~6,030", "~7,474", "~ +24%"],
          ["UMich consumer sentiment", "61.7 (Jul 2025)", "49.8 (Apr 2026)", "-11.9"],
          ["Federal funds rate", "4.33%", "~3.63%", "-0.70 pt"],
          ["U.S. unemployment", "~4.3%", "~4.4%", "Flat"],
        ],
      },
    },
    {
      heading: "Industry implications",
      paragraphs: [
        "The performance of women's instruction content suggests consumer appetite for gender-specific golf education is underserved relative to demonstrated demand. Providers that expand women-focused curriculum may find a receptive, self-identifying audience.",
        "The concentration of inquiries in a single paid-search channel reflects the effectiveness of paid search but indicates structural dependence on one acquisition channel, a dependency that may carry cost-stability implications as 2026 election-year advertising competition intensifies in Q3 to Q4.",
      ],
    },
  ],

  faqs: [
    { question: "When is demand for golf school instruction highest in the United States?", answer: "Demand peaks in January. January 2026 generated approximately 15,600 web sessions, about four times the seasonal low, with a secondary inquiry peak in February to March and an additional planning peak in July." },
    { question: "Is demand for golf instruction seasonal?", answer: "Yes. Demand follows a strong winter-to-spring pattern, with the December to April window holding the majority of high-intent activity; March and April 2026 together produced approximately 28,600 web sessions." },
    { question: "When is demand for golf schools lowest?", answer: "In early summer. June 2025 recorded approximately 3,900 web sessions and June 2026 approximately 5,600." },
    { question: "How do consumers discover and inquire about golf schools?", answer: "Web discovery is split across organic search (~26%), paid search (~21%), and paid social (~20%). Phone inquiries are far more concentrated: approximately 96% originate from Google Ads." },
    { question: "Does summer web traffic convert into golf school inquiries?", answer: "Less effectively. Although August 2025 web sessions remained above 9,400, inquiry share fell approximately 36% from the July peak." },
    { question: "Did the 2025-2026 economy affect golf school demand?", answer: "Demand remained broadly stable across a divergent backdrop: the S&P 500 rose ~24%, consumer sentiment fell 11.9 points, the federal funds rate eased to ~3.63%, and unemployment held near 4.3 to 4.4 percent. No causation is asserted." },
    { question: "Which golf instruction segments are growing?", answer: "Women's instruction is a distinct, growing segment (top-five content, ~4,000 sessions), and gift-experience interest is measurable (~2,000 sessions)." },
    { question: "How dependent is golf school inquiry volume on paid search?", answer: "Highly dependent: approximately 96% of phone inquiries originate from Google Ads, a concentration that may carry cost-stability implications as election-year ad competition intensifies in Q3 to Q4 2026." },
  ],

  methodology: [
    "This research draws on first-party digital data collected by Bird Golf, a U.S. national golf instruction provider. Web engagement data spans approximately 365 days and encompasses several hundred thousand sessions measured via Google Analytics. Inbound inquiry data was aggregated via CallRail and is expressed as share percentages and relative indices rather than absolute counts.",
    "External context was drawn from public datasets: consumer sentiment and unemployment via FRED; the 30-year mortgage rate and federal funds rate via FRED; the S&P 500 monthly close via S&P Dow Jones Indices; and national composite weather via Open-Meteo. Correlations are coincident or contextual; no causal relationships are asserted.",
    "Limitations. Web data reflects national-scale engagement and does not isolate geographic sub-markets. Inquiry data is expressed in share and index form only. Sentiment and unemployment figures are national averages. Findings represent observed patterns within this dataset and observation window.",
  ],

  dataSources: [
    "Google Analytics - first-party web sessions, channel attribution, and top content (365 days ending June 2026).",
    "CallRail - first-party inbound inquiry source share, answer rate, and first-time-caller share.",
    "FRED - University of Michigan Consumer Sentiment (UMCSENT) and U.S. Unemployment Rate (UNRATE).",
    "FRED - 30-Year Fixed Mortgage Rate (MORTGAGE30US) and Federal Funds Effective Rate (FEDFUNDS).",
    "S&P Dow Jones Indices (via FRED) - S&P 500 monthly close.",
    "Open-Meteo - national composite monthly weather, used for seasonal context.",
  ],

  keywords: [
    "golf school demand", "golf instruction", "golf lessons", "seasonal demand",
    "women's golf instruction", "golf industry trends", "golf marketing",
  ],
  about: [
    "Golf school enrollment", "Golf instruction demand", "Seasonal consumer demand",
    "Golf industry trends", "Women's golf instruction",
  ],
  abstract:
    "Across the 13 months ending June 2026, U.S. golf school enrollment demand peaked in January (~15,600 web sessions, roughly four times the seasonal low), concentrated high-intent activity in the December to April window, drew ~96% of phone inquiries from Google Ads, surfaced a growing women's-instruction segment, and remained stable despite an 11.9-point decline in consumer sentiment.",

  sourceStampEnabled: false,
};
