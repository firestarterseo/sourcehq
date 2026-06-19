'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import type { SourceReport } from '@/lib/report-types'
import { renderContentHtml, renderSchemaScriptTag, renderSchemaJson } from '@/lib/report-export'

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

// Minimal neutral styling for the in-app preview ONLY. This never travels with
// the copied HTML - it just makes the naked semantic fragment readable on screen,
// honestly previewing how a themed host site will render it.
const PREVIEW_CSS = `
.srcv{max-width:720px;color:#1f2328;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;}
.srcv h1{font-size:28px;line-height:1.2;margin:0 0 12px;font-weight:600;}
.srcv h2{font-size:21px;margin:34px 0 10px;font-weight:600;}
.srcv h3{font-size:16px;margin:20px 0 6px;font-weight:600;}
.srcv p{margin:0 0 15px;}
.srcv ul{padding-left:22px;margin:0 0 15px;}
.srcv li{margin-bottom:6px;}
.srcv table{width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;}
.srcv th,.srcv td{text-align:left;padding:8px 11px;border:1px solid #d8dade;}
.srcv th{background:#f4f5f6;}
.srcv caption{text-align:left;font-size:13px;color:#5c6168;margin-bottom:6px;}
.srcv blockquote{border-left:3px solid #c9ccd1;margin:18px 0;padding:6px 16px;color:#5c6168;}
.srcv hr{border:none;border-top:1px solid #e2e4e7;margin:32px 0;}
.srcv em{color:#5c6168;}
.srcv figure{margin:24px 0;}
.srcv figure table{display:none;}
`

function slugify(s: string): string {
  return (s || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'report'
}

function downloadFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
  const [schemaCopied, setSchemaCopied] = useState(false)
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

  // The single source of truth: the in-app preview renders exactly what Copy emits.
  const contentHtml = isPublication && c ? renderContentHtml(c as SourceReport) : ''
  const fileBase = report ? slugify(report.title) : 'report'

  async function copyHtml() {
    if (!contentHtml) return
    try {
      await navigator.clipboard.writeText(contentHtml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  async function copySchema() {
    if (!isPublication || !c) return
    try {
      await navigator.clipboard.writeText(renderSchemaScriptTag(c as SourceReport))
      setSchemaCopied(true)
      setTimeout(() => setSchemaCopied(false), 2500)
    } catch {}
  }

  function downloadHtml() {
    if (!contentHtml) return
    downloadFile(`${fileBase}.html`, contentHtml, 'text/html;charset=utf-8')
  }

  function downloadSchema() {
    if (!isPublication || !c) return
    downloadFile(`${fileBase}.schema.json`, renderSchemaJson(c as SourceReport), 'application/json;charset=utf-8')
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

  const btn = (active: boolean) => ({
    background: active ? '#10B981' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '7px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
  } as const)

  const ghostBtn = {
    background: 'transparent', color: '#6D28D9', border: '0.5px solid #6D28D9', borderRadius: '8px',
    padding: '7px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
  } as const

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Reports" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
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
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', padding: '8px 0' }}>
              <button onClick={copyHtml} style={btn(copied)}>
                {copied ? 'Copied!' : 'Copy HTML'}
              </button>
              <button onClick={copySchema} style={{ ...btn(schemaCopied), ...(schemaCopied ? {} : { background: 'transparent', color: '#6D28D9', border: '0.5px solid #6D28D9' }) }}>
                {schemaCopied ? 'Copied!' : 'Copy schema'}
              </button>
              <button onClick={downloadHtml} style={ghostBtn}>Download .html</button>
              <button onClick={downloadSchema} style={ghostBtn}>Download .json</button>
            </div>
          )}
        </div>

        <div style={{ padding: '32px', maxWidth: '820px' }}>
          {loading ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading report...</p>
          ) : !report || !c ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Report not found. <Link href="/dashboard/reports" style={{ color: '#6D28D9' }}>Back to reports</Link></p>
          ) : isPublication ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: '#EDE9FE', color: '#6D28D9' }}>Citable Publication</span>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Preview reflects the exported HTML. Your site styles fonts &amp; colors.</span>
              </div>
              <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '40px 44px' }}>
                <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
                <div className="srcv" dangerouslySetInnerHTML={{ __html: contentHtml }} />
              </div>

              <div style={{ ...CARD, marginTop: '16px' }}>
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
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: 600, color: '#0D1B3E', marginBottom: '6px' }}>{report.title}</h1>
                <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {report.period ? `${report.period} · ` : ''}Generated {new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
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
        </div>
      </div>
    </div>
  )
}

