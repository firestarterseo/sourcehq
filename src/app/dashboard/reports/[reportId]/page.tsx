'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface Citation {
  source?: string
  url?: string
  description?: string
}

interface ReportContent {
  title?: string
  executive_summary?: string
  wins?: string[]
  concerns?: string[]
  opportunities?: string[]
  actions?: string[]
  citations?: Citation[]
  report_type?: string
}

interface Report {
  id: string
  title: string
  period: string | null
  created_at: string
  content: ReportContent
}

function Section({ title, items, color }: { title: string; items?: string[]; color: string }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '15px', fontWeight: '600', color: '#0D1B3E', marginBottom: '14px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, marginTop: '7px', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', margin: 0 }}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildHtml(report: Report): string {
  const c = report.content
  const pubDate = new Date(report.created_at).toISOString().split('T')[0]
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const list = (items?: string[]) => (items || []).map(i => `    <li>${esc(i)}</li>`).join('\n')

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.title || report.title,
    datePublished: pubDate,
    description: c.executive_summary || '',
    about: { '@type': 'Dataset', name: `${c.title || report.title} — underlying dataset`, temporalCoverage: report.period || '' },
    citation: (c.citations || []).filter(x => x.url).map(x => x.url),
  }

  return `<article>
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
<h1>${esc(c.title || report.title)}</h1>
<p><em>Published ${pubDate}${report.period ? ` · Data window: ${report.period}` : ''}</em></p>
<p><strong>${esc(c.executive_summary || '')}</strong></p>
<h2>Key findings</h2>
<ul>
${list(c.wins)}
</ul>
<h2>Notable patterns</h2>
<ul>
${list(c.concerns)}
</ul>
<h2>What this means</h2>
<ul>
${list(c.opportunities)}
</ul>
<h2>Methodology</h2>
<ul>
${list(c.actions)}
</ul>
<h2>Data sources</h2>
<ul>
${(c.citations || []).map(x => `    <li>${x.url ? `<a href="${esc(x.url)}" rel="noopener">${esc(x.source || x.url)}</a>` : esc(x.source || '')}${x.description ? ` — ${esc(x.description)}` : ''}</li>`).join('\n')}
</ul>
</article>`
}

export default function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/reports/${reportId}`)
      .then(r => r.json())
      .then(data => { setReport(data.report || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [reportId])

  const isPublication = report?.content?.report_type === 'publication'
  const labels = isPublication
    ? { wins: 'Key findings', concerns: 'Notable patterns', opportunities: 'What this means', actions: 'Methodology' }
    : { wins: 'Wins', concerns: 'Concerns', opportunities: 'Opportunities', actions: 'Recommended actions' }

  async function copyHtml() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(buildHtml(report))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Reports" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <Link href="/dashboard/reports" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', flexShrink: 0 }}>← Reports</Link>
            {report && (
              <>
                <span style={{ color: '#E5E5E3' }}>|</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.title}</span>
              </>
            )}
          </div>
          {report && isPublication && (
            <button onClick={copyHtml} style={{ background: copied ? '#10B981' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
              {copied ? 'Copied!' : 'Copy as HTML'}
            </button>
          )}
        </div>

        <div style={{ padding: '32px', maxWidth: '760px' }}>
          {loading ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading report...</p>
          ) : !report ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Report not found. <Link href="/dashboard/reports" style={{ color: '#6D28D9' }}>Back to reports</Link></p>
          ) : (
            <>
              <div style={{ marginBottom: '24px' }}>
                {isPublication && (
                  <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '500', padding: '3px 10px', borderRadius: '20px', background: '#EDE9FE', color: '#6D28D9', marginBottom: '10px' }}>Citable Publication</span>
                )}
                <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: '600', color: '#0D1B3E', marginBottom: '6px' }}>{report.title}</h1>
                <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {report.period ? `${report.period} · ` : ''}Generated {new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {report.content.executive_summary && (
                <div style={{ background: '#EDE9FE', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: '600', color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Executive summary</h3>
                  <p style={{ fontSize: '14px', color: '#0D1B3E', lineHeight: '1.7', margin: 0 }}>{report.content.executive_summary}</p>
                </div>
              )}

              <Section title={labels.wins} items={report.content.wins} color="#10B981" />
              <Section title={labels.concerns} items={report.content.concerns} color="#F59E0B" />
              <Section title={labels.opportunities} items={report.content.opportunities} color="#6D28D9" />
              <Section title={labels.actions} items={report.content.actions} color="#0D1B3E" />

              {(report.content.citations || []).length > 0 && (
                <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '15px', fontWeight: '600', color: '#0D1B3E', marginBottom: '14px' }}>Data sources</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(report.content.citations || []).map((cit, i) => (
                      <div key={i} style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                        {cit.url ? (
                          <a href={cit.url} target="_blank" rel="noopener noreferrer" style={{ color: '#6D28D9', fontWeight: 500 }}>{cit.source || cit.url}</a>
                        ) : (
                          <span style={{ fontWeight: 500 }}>{cit.source}</span>
                        )}
                        {cit.description ? <span style={{ color: '#6B7280' }}> — {cit.description}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
