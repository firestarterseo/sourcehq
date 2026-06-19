// src/components/SourceReportView.tsx
// Styled, in-app render of a SourceReport (the "screen / PDF" target).
// Scoped styles under .srv so nothing leaks into the rest of the app.

import type { SourceReport } from "@/lib/report-types";

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Inter:wght@500;600;700&display=swap");
.srv{max-width:760px;margin:0 auto;background:#FBFAF7;color:#1A1A17;font-family:"Source Serif 4",Georgia,serif;font-size:17px;line-height:1.65;padding:48px 40px;border:1px solid #E2DED3;border-radius:2px;}
.srv .kick{font-family:Inter,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#B0832E;font-weight:600;margin:0 0 14px;}
.srv h1{font-family:Fraunces,serif;font-weight:600;font-size:30px;line-height:1.2;margin:0 0 14px;}
.srv .dek{font-size:18px;color:#5C6158;margin:0 0 18px;}
.srv .byline{font-family:Inter,sans-serif;font-size:12.5px;color:#5C6158;border-top:1px solid #E2DED3;border-bottom:1px solid #E2DED3;padding:11px 0;margin:0 0 8px;}
.srv .byline b{color:#1A1A17;}
.srv blockquote{font-family:Inter,sans-serif;font-size:12.5px;color:#5C6158;background:#F1EEE4;border-left:3px solid #B0832E;padding:12px 16px;margin:18px 0 36px;}
.srv blockquote p{margin:0;}
.srv h2{font-family:Fraunces,serif;font-weight:600;font-size:22px;margin:40px 0 12px;}
.srv h3{font-family:Inter,sans-serif;font-weight:600;font-size:15px;margin:22px 0 6px;}
.srv p{margin:0 0 16px;}
.srv .stats{background:#fff;border:1px solid #E2DED3;padding:20px 22px;margin:30px 0;}
.srv .stats .lab{font-family:Inter,sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#B0832E;font-weight:600;margin:0 0 12px;}
.srv .stats .row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #E2DED3;}
.srv .stats .row.last{border-bottom:none;}
.srv .stats .v{font-family:Inter,sans-serif;font-weight:700;color:#1F4D3A;text-align:right;white-space:nowrap;}
.srv .finding{position:relative;background:#fff;border:1px solid #E2DED3;border-left:3px solid #1F4D3A;padding:15px 18px 15px 46px;margin:13px 0;}
.srv .finding .num{position:absolute;left:13px;top:15px;font-family:Inter,sans-serif;font-weight:700;font-size:12px;color:#fff;background:#1F4D3A;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.srv .finding h3{margin:0 0 4px;}
.srv .finding p{margin:0;}
.srv table{width:100%;border-collapse:collapse;margin:22px 0;font-family:Inter,sans-serif;font-size:13px;}
.srv th,.srv td{text-align:left;padding:9px 11px;border-bottom:1px solid #E2DED3;}
.srv th{color:#5C6158;font-size:11px;letter-spacing:.06em;text-transform:uppercase;}
.srv caption{text-align:left;font-family:Inter,sans-serif;font-size:11.5px;color:#5C6158;margin-bottom:8px;}
.srv ul{padding-left:20px;margin:0;}
.srv li{margin-bottom:6px;font-family:Inter,sans-serif;font-size:14px;color:#5C6158;}
.srv .foot{font-family:Inter,sans-serif;font-size:11.5px;color:#5C6158;border-top:1px solid #E2DED3;margin-top:40px;padding-top:18px;}
.srv .strip{display:grid;gap:10px;margin:30px 0;}
.srv .strip .cell{background:#fff;border:1px solid #E2DED3;padding:15px 14px;}
.srv .strip .cell .n{font-family:Fraunces,serif;font-weight:600;font-size:21px;color:#1F4D3A;line-height:1.15;}
.srv .strip .cell .l{font-family:Inter,sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#5C6158;margin-top:6px;}
.srv .limits{background:#fff;border:1px solid #E2DED3;border-left:4px solid #B0832E;padding:14px 18px;margin:18px 0;}
.srv .limits p{margin:0;font-size:15px;color:#5C6158;}
@media(max-width:560px){.srv .strip{grid-template-columns:1fr 1fr !important;}}
@media(max-width:560px){.srv{padding:32px 20px;}.srv h1{font-size:24px;}}
`;

export default function SourceReportView({ report }: { report: SourceReport }) {
  return (
    <div className="srv">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <p className="kick">{report.publisher} - First-Party Industry Study</p>
      <h1>{report.title}</h1>
      <p className="dek">{report.dek}</p>

      <p className="byline">
        <b>Publisher:</b> {report.publisher} &nbsp;&middot;&nbsp;{" "}
        <b>Published:</b> {report.datePublished} &nbsp;&middot;&nbsp;{" "}
        <b>Coverage:</b> {report.coverage}
      </p>
      <blockquote><p>{report.citation}</p></blockquote>

      {report.keyStats?.length > 0 && (
        <div className="strip" style={{ gridTemplateColumns: `repeat(${Math.min(report.keyStats.length, 4)}, 1fr)` }}>
          {report.keyStats.map((s, i) => (
            <div className="cell" key={i}>
              <div className="n">{s.value}</div>
              <div className="l">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {report.executiveSummary?.length > 0 && (
        <>
          <h2>Executive summary</h2>
          {report.executiveSummary.map((p, i) => <p key={i}>{p}</p>)}
        </>
      )}

      {report.findings?.length > 0 && (
        <>
          <h2>Findings</h2>
          {report.findings.map((f, i) => (
            <div className="finding" key={i}>
              <span className="num">{i + 1}</span>
              <h3>{f.heading}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </>
      )}

      {report.sections?.map((sec, i) => (
        <div key={i}>
          <h2>{sec.heading}</h2>
          {sec.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
          {sec.table && (
            <table>
              {sec.table.caption && <caption>{sec.table.caption}</caption>}
              <thead>
                <tr>{sec.table.columns.map((c, k) => <th key={k}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {sec.table.rows.map((r, k) => (
                  <tr key={k}>{r.map((cell, m) => <td key={m}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {report.faqs?.length > 0 && (
        <>
          <h2>Frequently asked questions</h2>
          {report.faqs.map((q, i) => (
            <div key={i}>
              <h3>{q.question}</h3>
              <p>{q.answer}</p>
            </div>
          ))}
        </>
      )}

      {report.methodology?.length > 0 && (
        <>
          <h2>Methodology</h2>
          {report.methodology.map((p, i) =>
            /^limitations[.:]/i.test(p.trim())
              ? <div className="limits" key={i}><p>{p}</p></div>
              : <p key={i}>{p}</p>
          )}
        </>
      )}

      {report.dataSources?.length > 0 && (
        <>
          <h2>Data sources</h2>
          <ul>{report.dataSources.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </>
      )}

      <div className="foot">
        Published by {report.publisher}. Free to cite with attribution.
        {report.sourceStampEnabled ? " Researched with the SOURCE method - SOURCED NOT CITED." : ""}
      </div>
    </div>
  );
}
