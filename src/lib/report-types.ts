// src/lib/report-types.ts
// Canonical data contract for a SOURCE research report.
// The generator produces this shape; the styled preview, the PDF, and the
// blog exporter all consume it. One contract, three render targets.
import type { MacroAnalysis } from '@/lib/macro-analysis'

export interface ReportStat {
  label: string;
  value: string;
}
export interface ReportFinding {
  heading: string;
  body: string;
}
export interface ReportTable {
  caption?: string;
  columns: string[];
  rows: string[][];
}
export interface ReportSection {
  heading: string;
  paragraphs: string[];
  table?: ReportTable;
}
export interface ReportFAQ {
  question: string;
  answer: string;
}
export interface SourceReport {
  // Front matter / identity
  title: string;
  dek: string;
  publisher: string;          // e.g. "Bird Golf Research"
  publisherUrl?: string;      // e.g. "https://www.birdgolf.com/"
  datePublished: string;      // ISO date, e.g. "2026-06-15"
  coverage: string;           // e.g. "June 2025 - June 2026, United States"
  canonicalUrl?: string;      // where it will live on the client domain
  citation: string;           // full "Cite this report as: ..." string
  // Body
  keyStats: ReportStat[];
  executiveSummary: string[]; // paragraphs
  findings: ReportFinding[];
  sections: ReportSection[];  // seasonal detail, macro backdrop (+ table), industry implications
  faqs: ReportFAQ[];
  methodology: string[];      // paragraphs; final paragraph may begin "Limitations."
  dataSources: string[];      // bullet list items
  // Computed macro analysis (deterministic; numbers from code, not the LLM)
  macro?: MacroAnalysis;
  // Schema / metadata
  keywords: string[];
  about: string[];
  abstract: string;
  // Options
  sourceStampEnabled?: boolean; // show "Researched with the SOURCE method" footer
}
