"use client";

import { useState } from "react";
import SourceReportView from "@/components/SourceReportView";
import { SAMPLE_REPORT } from "@/lib/report-sample";
import { renderContentHtml, renderSchemaJson } from "@/lib/report-export";

export default function ReportPreviewPage() {
  const report = SAMPLE_REPORT;
  const contentHtml = renderContentHtml(report);
  const schemaJson = renderSchemaJson(report);
  const [copied, setCopied] = useState("");

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  }

  const btn: React.CSSProperties = {
    fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
    background: "#1F4D3A", color: "#fff", border: "none", borderRadius: 6,
    padding: "8px 14px", cursor: "pointer",
  };
  const area: React.CSSProperties = {
    width: "100%", minHeight: 200, fontFamily: "monospace", fontSize: 12,
    padding: 12, border: "1px solid #E2DED3", borderRadius: 6, background: "#fff",
    whiteSpace: "pre", overflow: "auto",
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Report preview &amp; export</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 28 }}>
        Sample data, rendered through the real components. The styled view is the screen/PDF target;
        the two export blocks below are the style-free files for the client&apos;s blog.
      </p>

      <SourceReportView report={report} />

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "40px 0 12px" }}>Export for blog</h2>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>content.html &mdash; paste into the blog body</strong>
          <button style={btn} onClick={() => copy(contentHtml, "content")}>
            {copied === "content" ? "Copied" : "Copy"}
          </button>
        </div>
        <textarea readOnly style={area} value={contentHtml} />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>schema.json &mdash; paste into the schema / header plugin</strong>
          <button style={btn} onClick={() => copy(schemaJson, "schema")}>
            {copied === "schema" ? "Copied" : "Copy"}
          </button>
        </div>
        <textarea readOnly style={area} value={schemaJson} />
      </div>
    </div>
  );
}
