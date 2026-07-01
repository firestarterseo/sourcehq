'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PLATFORM_LABELS, type DerivativePlatform } from '@/lib/derivative-prompts'

interface ReportRow {
  id: string
  title: string
  period: string | null
  created_at: string
}

interface Derivative {
  id: string
  report_id: string
  platform: DerivativePlatform
  target: string | null
  title: string
  subtitle: string | null
  body: string
  meta: Record<string, any> | null
  status: 'draft' | 'approved'
  created_at: string
  updated_at: string
  reports?: { title: string } | null
}

const PLATFORMS: DerivativePlatform[] = ['linkedin', 'reddit', 'medium', 'pr_wire']

const CARD = { background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px', marginBottom: '16px' } as const
const H3 = { fontFamily: 'Outfit, sans-serif', fontSize: '15px', fontWeight: 600, color: '#0D1B3E', marginBottom: '14px' } as const
const selectStyle = {
  width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px',
  fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff',
} as const

export default function DistributionTab({ clientId }: { clientId: string }) {
  const [reports, setReports] = useState<ReportRow[] | null>(null)
  const [derivatives, setDerivatives] = useState<Derivative[] | null>(null)
  const [selectedReportId, setSelectedReportId] = useState('')
  const [generatingPlatform, setGeneratingPlatform] = useState<DerivativePlatform | null>(null)
  const [genError, setGenError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function loadReports() {
    fetch(`/api/clients/${clientId}/report`)
      .then(r => r.json())
      .then(data => {
        setReports(data.reports || [])
        if (data.reports?.length && !selectedReportId) setSelectedReportId(data.reports[0].id)
      })
      .catch(() => setReports([]))
  }

  function loadDerivatives() {
    fetch(`/api/clients/${clientId}/derivatives`)
      .then(r => r.json())
      .then(data => setDerivatives(data.derivatives || []))
      .catch(() => setDerivatives([]))
  }

  useEffect(() => {
    loadReports()
    loadDerivatives()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function generate(platform: DerivativePlatform) {
    if (!selectedReportId) return
    setGeneratingPlatform(platform)
    setGenError('')
    try {
      const res = await fetch(`/api/reports/${selectedReportId}/derivatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      if (!res.ok) { setGenError(data.error || 'Failed to generate'); setGeneratingPlatform(null); return }
      loadDerivatives()
    } catch {
      setGenError('Failed to generate')
    }
    setGeneratingPlatform(null)
  }

  function startEdit(d: Derivative) {
    setExpandedId(d.id)
    setEditTitle(d.title)
    setEditBody(d.body)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/derivatives/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    })
    if (res.ok) loadDerivatives()
    setSaving(false)
  }

  async function toggleApproved(d: Derivative) {
    const nextStatus = d.status === 'approved' ? 'draft' : 'approved'
    await fetch(`/api/derivatives/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    loadDerivatives()
  }

  async function deleteDerivative(id: string) {
    await fetch(`/api/derivatives/${id}`, { method: 'DELETE' })
    if (expandedId === id) setExpandedId(null)
    loadDerivatives()
  }

  async function copyBody(d: Derivative) {
    try {
      await navigator.clipboard.writeText(d.body)
      setCopiedId(d.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const hasReports = reports && reports.length > 0

  return (
    <>
      <div style={CARD}>
        <h3 style={H3}>Spin off a derivative</h3>
        {!hasReports ? (
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            No publications yet. Generate one under Content first.
          </p>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#0D1B3E', marginBottom: '6px' }}>Source publication</label>
              <select value={selectedReportId} onChange={e => setSelectedReportId(e.target.value)} style={selectStyle}>
                {(reports || []).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => generate(p)}
                  disabled={!!generatingPlatform || !selectedReportId}
                  style={{
                    background: generatingPlatform ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: generatingPlatform ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {generatingPlatform === p ? 'Writing...' : `Spin off ${PLATFORM_LABELS[p]}`}
                </button>
              ))}
            </div>
            {genError && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#991B1B', marginTop: '12px' }}>{genError}</div>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ ...H3, marginBottom: 0 }}>Drafts</h3>
        {derivatives && derivatives.length > 0 && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{derivatives.length} item{derivatives.length === 1 ? '' : 's'}</span>}
      </div>

      {!derivatives ? (
        <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading...</p>
      ) : derivatives.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>Nothing spun off yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {derivatives.map(d => (
            <div key={d.id} style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', gap: '12px', cursor: 'pointer' }} onClick={() => expandedId === d.id ? setExpandedId(null) : startEdit(d)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: '#EDE9FE', color: '#6D28D9' }}>{PLATFORM_LABELS[d.platform]}</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: d.status === 'approved' ? '#D1FAE5' : '#F3F4F6', color: d.status === 'approved' ? '#065F46' : '#6B7280' }}>{d.status}</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#0D1B3E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{d.reports?.title || ''} · {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              </div>
              {expandedId === d.id && (
                <div style={{ padding: '0 18px 18px', borderTop: '0.5px solid #F3F4F6' }}>
                  <div style={{ marginTop: '14px', marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#0D1B3E', marginBottom: '5px' }}>Title</label>
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={selectStyle} />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#0D1B3E', marginBottom: '5px' }}>Body</label>
                    <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={12} style={{ ...selectStyle, fontFamily: 'DM Sans, sans-serif', resize: 'vertical', lineHeight: 1.6 }} />
                  </div>
                  {d.platform === 'reddit' && d.meta?.subredditSuggestions?.length > 0 && (
                    <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>Suggested subreddits: {d.meta!.subredditSuggestions.join(', ')}</p>
                  )}
                  {d.platform === 'medium' && d.meta?.tags?.length > 0 && (
                    <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>Tags: {d.meta!.tags.join(', ')}</p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => saveEdit(d.id)} disabled={saving} style={{ background: saving ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button onClick={() => toggleApproved(d)} style={{ background: 'transparent', color: d.status === 'approved' ? '#6B7280' : '#059669', border: `0.5px solid ${d.status === 'approved' ? '#E5E5E3' : '#059669'}`, borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{d.status === 'approved' ? 'Unapprove' : 'Approve'}</button>
                    <button onClick={() => copyBody(d)} style={{ background: 'transparent', color: '#6D28D9', border: '0.5px solid #6D28D9', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{copiedId === d.id ? 'Copied!' : 'Copy'}</button>
                    <button onClick={() => deleteDerivative(d.id)} style={{ background: 'transparent', color: '#DC2626', border: '0.5px solid #DC2626', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Delete</button>
                    <Link href={`/dashboard/reports/${d.report_id}`} style={{ background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}>View source report</Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

