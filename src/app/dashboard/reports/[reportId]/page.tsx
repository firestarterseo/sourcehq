'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import type { SourceReport } from '@/lib/report-types'

interface InternalContent {
  title?: string
  executive_summary?: string
  wins?: string[]
  concerns?: string[]
  opportunities?: string[]
  actions?: string[]
  report_type?: string
}

type Content = (Partial<SourceReport> & { report_type?: string }) & InternalContent

interface Report {
  id: string
  title: string
  period: string | null
  created_at: string
  content: Content
}

const DERIVATIVES = [
  { key: 'linkedin', label: 'LinkedIn post' },
  { key: 'twitter', label: 'X thread' },
  { key: 'email', label: 'Email block' },
  { key: 'gbp', label: 'GBP post' },
  { key: 'press', label: 'Press pitch' },
]

const CARD = { background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px', marginBottom: '16px' }
const H3 = { fontFamily: 'Outfit, sans-serif', fontSize: '15px', fontWeight: 600, color: '#0D1B3E', marginBottom: '14px' } as const

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildHtml(report: Report): string {
  const c = report.content
  const pubDate = c.datePublished || new Date(report.created_at).toISOString().split('T')[0]
  const para = (arr?: string[]) => (arr || []).map(p => `<p>${esc(p)}</p>`).join('\n')

  const reportSchema = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    headline: c.title || report.title,
    abstract: c.abstract || c.dek || '',
    datePublished: pubDate,
    author: { '@type': 'Organization', name: c.publisher || '', url: c.publisherUrl || undefined },
    publisher: { '@type': 'Organization', name: c.publisher || '' },
    temporalCoverage: c.coverage || report.period || '',
    keywords: (c.keywords || []).join(', '),
    about: (c.about || []).map(a => ({ '@type': 'Thing', name: a })),
  }
  const faqSchema = (c.faqs && c.faqs.length) ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null

  const statsBlock = (c.keyStats && c.keyStats.length)
    ? `<h2>Key statistics</h2>\n<ul>\n${c.keyStats.map(s => `  <li><strong>${esc(s.value)}</strong> — ${esc(s.label)}</li>`).join('\n')}\n</ul>`
    : ''
  const findingsBlock = (c.findings && c.findings.length)
    ? `<h2>Key findings</h2>\n${c.findings.map(f => `${f.heading ? `<h3>${esc(f.heading)}</h3>\n` : ''}<p>${esc(f.body)}</p>`).join('\n')}`
    : ''
  const sectionsBlock = (c.sections || []).map(s =>
    `<h2>${esc(s.heading)}</h2>\n${para(s.paragraphs)}`).join('\n')
  const faqBlock = (c.faqs && c.faqs.length)
    ? `<h2>Frequently asked questions</h2>\n${c.faqs.map(f => `<h3>${esc(f.question)}</h3>\n<p>${esc(f.answer)}</p>`).join('\n')}`
    : ''
  const methodBlock = (c.methodology && c.methodology.length)
    ? `<h2>Methodology</h2>\n${para(c.methodology)}`
    : ''
  const sourcesBlock = (c.dataSources && c.dataSources.length)
    ? `<h2>Data sources</h2>\n<ul>\n${c.dataSources.map(d => `  <li>${esc(d)}</li>`).join('\n')}\n</ul>`
    : ''

  return `<article>
<script type="application/ld+json">
${JSON.stringify(reportSchema, null, 2)}
</script>${faqSchema ? `\n<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>` : ''}
<h1>${esc(c.title || report.title)}</h1>
${c.dek ? `<p><em>${esc(c.dek)}</em></p>` : ''}
<p><em>Published ${pubDate}${c.coverage ? ` · ${esc(c.coverage)}` : ''}</em></p>
${statsBlock}
<h2>Executive summary</h2>
${para(c.executiveSummary)}
${findingsBlock}
${sectionsBlock}
${faqBlock}
${methodBlock}
${sourcesBlock}
${c.citation ? `<p><small>${esc(c.citation)}</small></p>` : ''}
</article>`
}

function InternalSection({ title, items, color }: { title: string; items?: string[]; color: string }) {
  if (!items || items.length === 0) return null
  return (
    <div style={CARD}>
      <h3 style={H3}>{title}</h3>
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

export default function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [activeDeriv, setActiveDeriv] = useState<string | null>(null)
  const [derivLoading, setDerivLoading] = useState<string | null>(null)
  const [derivText, setDerivText] = useState<Record<string, string>>({})
  const [derivCopied, setDerivCopied] = useState(false)
  const [derivError, setDerivError] = useState('')

  useEffect(() => {
    fetch(`/api/reports/${reportId}`)
      .then(r => r.json())
      .then(data => { setReport(data.report || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [reportId])

  const c = report?.content
  const isPublication = c?.report_type === 'publication'

  async function copyHtml() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(buildHtml(report))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  async function runDerivative(key: string) {
    setActiveDeriv(key)
    setDerivError('')
    if (derivText[key]) return
    setDerivLoading(key)
    try {
      const res = await fetch(`/api/reports/${reportId}/derive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: key }),
      })
      const data = await res.json()
      if (!res.ok) { setDerivError(data.error || 'Failed to generate'); setDerivLoading(null); return }
      setDerivText(prev => ({ ...prev, [key]: data.text }))
    } catch {
      setDerivError('Failed to generate')
    }
    setDerivLoading(null)
  }

  async function copyDeriv() {
    if (!activeDeriv || !derivText[activeDeriv]) return
    try {
      await navigator.clipboard.writeText(derivText[activeDeriv])
      setDerivCopied(true)
      setTimeout(() => setDerivCopied(false), 2000)
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
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#0D1B3E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.title}</span>
              </>
            )}
          </div>
          {report && isPublication && (
            <button onClick={copyHtml} style={{ background: copied ? '#10B981' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
              {copied ? 'Copied!' : 'Copy as HTML'}
            </button>
          )}
        </div>

        <div style={{ padding: '32px', maxWidth: '760px' }}>
          {loading ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading report...</p>
          ) : !report || !c ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Report not found. <Link href="/dashboard/reports" style={{ color: '#6D28D9' }}>Back to reports</Link></p>
          ) : (
            <>
              <div style={{ marginBottom: '24px' }}>
                {isPublication && (
                  <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: '#EDE9FE', color: '#6D28D9', marginBottom: '10px' }}>Citable Publication</span>
                )}
                <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: 600, color: '#0D1B3E', marginBottom: '6px' }}>{report.title}</h1>
                {isPublication && c.dek && (
                  <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.6, marginBottom: '8px' }}>{c.dek}</p>
                )}
                <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {c.coverage ? `${c.coverage} · ` : report.period ? `${report.period} · ` : ''}Generated {new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {isPublication ? (
                <>
                  {c.keyStats && c.keyStats.length > 0 && (
                    <div style={{ ...CARD, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
                      {c.keyStats.map((s, i) => (
                        <div key={i}>
                          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: 600, color: '#6D28D9', lineHeight: 1.1 }}>{s.value}</div>
                          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', lineHeight: 1.4 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {c.executiveSummary && c.executiveSummary.length > 0 && (
                    <div style={{ background: '#EDE9FE', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Executive summary</h3>
                      {c.executiveSummary.map((p, i) => (
                        <p key={i} style={{ fontSize: '14px', color: '#0D1B3E', lineHeight: 1.7, margin: i === 0 ? 0 : '10px 0 0' }}>{p}</p>
                      ))}
                    </div>
                  )}

                  {c.findings && c.findings.length > 0 && (
                    <div style={CARD}>
                      <h3 style={H3}>Key findings</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {c.findings.map((f, i) => (
                          <div key={i}>
                            {f.heading && <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 600, color: '#0D1B3E', marginBottom: '4px' }}>{f.heading}</div>}
                            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, margin: 0 }}>{f.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(c.sections || []).map((s, i) => (
                    <div key={i} style={CARD}>
                      <h3 style={H3}>{s.heading}</h3>
                      {s.paragraphs.map((p, j) => (
                        <p key={j} style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7, margin: j === 0 ? 0 : '10px 0 0' }}>{p}</p>
                      ))}
                    </div>
                  ))}

                  {c.faqs && c.faqs.length > 0 && (
                    <div style={CARD}>
                      <h3 style={H3}>Frequently asked questions</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {c.faqs.map((f, i) => (
                          <div key={i}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0D1B3E', marginBottom: '4px' }}>{f.question}</div>
                            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, margin: 0 }}>{f.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {c.methodology && c.methodology.length > 0 && (
                    <div style={CARD}>
                      <h3 style={H3}>Methodology</h3>
                      {c.methodology.map((p, i) => (
                        <p key={i} style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7, margin: i === 0 ? 0 : '10px 0 0' }}>{p}</p>
                      ))}
                    </div>
                  )}

                  {c.dataSources && c.dataSources.length > 0 && (
                    <div style={CARD}>
                      <h3 style={H3}>Data sources</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {c.dataSources.map((d, i) => (
                          <p key={i} style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, margin: 0 }}>{d}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {c.citation && (
                    <p style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic', marginBottom: '16px' }}>{c.citation}</p>
                  )}

                  <div style={CARD}>
                    <h3 style={{ ...H3, marginBottom: '4px' }}>Repurpose</h3>
                    <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '14px' }}>Turn this study into ready-to-post content. Generated fresh each time.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: derivError || activeDeriv ? '16px' : 0 }}>
                      {DERIVATIVES.map(d => (
                        <button key={d.key} onClick={() => runDerivative(d.key)} disabled={!!derivLoading}
                          style={{ background: activeDeriv === d.key ? '#6D28D9' : 'transparent', color: activeDeriv === d.key ? '#fff' : '#6D28D9', border: '0.5px solid #6D28D9', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 500, cursor: derivLoading ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          {derivLoading === d.key ? 'Writing...' : d.label}
                        </button>
                      ))}
                    </div>
                    {derivError && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#991B1B' }}>{derivError}</div>}
                    {activeDeriv && derivText[activeDeriv] && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                          <button onClick={copyDeriv} style={{ background: derivCopied ? '#10B981' : '#EDE9FE', color: derivCopied ? '#fff' : '#6D28D9', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                            {derivCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ background: '#FAFAF8', border: '0.5px solid #F3F4F6', borderRadius: '10px', padding: '16px', fontSize: '13px', color: '#0D1B3E', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {derivText[activeDeriv]}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {c.executive_summary && (
                    <div style={{ background: '#EDE9FE', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Executive summary</h3>
                      <p style={{ fontSize: '14px', color: '#0D1B3E', lineHeight: 1.7, margin: 0 }}>{c.executive_summary}</p>
                    </div>
                  )}
                  <InternalSection title="Wins" items={c.wins} color="#10B981" />
                  <InternalSection title="Concerns" items={c.concerns} color="#F59E0B" />
                  <InternalSection title="Opportunities" items={c.opportunities} color="#6D28D9" />
                  <InternalSection title="Recommended actions" items={c.actions} color="#0D1B3E" />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
