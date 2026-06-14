'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

const SOURCE_META: Record<string, { title: string; endpoint: string }> = {
  gsc: { title: 'Search Console', endpoint: 'gsc' },
  ga4: { title: 'Traffic (GA4)', endpoint: 'ga4' },
  callrail: { title: 'Calls (CallRail)', endpoint: 'callrail' },
}

const WINDOWS = [
  { v: 28, label: 'Last 28 days' },
  { v: 90, label: 'Last 90 days' },
  { v: 180, label: 'Last 6 months' },
  { v: 365, label: 'Last 12 months' },
  { v: 730, label: 'Last 2 years' },
]

function fmt(n: number) { return n.toLocaleString('en-US') }
function fmtDuration(sec: number) { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, '0')}` }

function StatCards({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`, gap: '12px', marginBottom: '24px' }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: '#EDE9FE', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{s.label}</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: '600', color: '#0D1B3E' }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

function BarChart({ title, data }: { title: string; data: { date: string; value: number }[] }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const fmtD = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0D1B3E', marginBottom: '10px' }}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px', padding: '12px', background: '#FAFAF8', borderRadius: '10px', border: '0.5px solid #F3F4F6' }}>
        {data.map((d, i) => (
          <div key={i} title={`${fmtD(d.date)}: ${fmt(d.value)}`} style={{ flex: 1, height: `${Math.max((d.value / max) * 100, 2)}%`, background: '#6D28D9', borderRadius: '2px 2px 0 0', minWidth: '1px', opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 12px' }}>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{fmtD(data[0].date)}</span>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{fmtD(data[data.length - 1].date)}</span>
      </div>
    </div>
  )
}

function SimpleTable({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <div>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0D1B3E', marginBottom: '10px' }}>{title}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.length === 0 && <tr><td style={{ fontSize: '12px', color: '#9CA3AF', padding: '12px 0', textAlign: 'center' }}>No data</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '0.5px solid #F3F4F6' }}>
              <td style={{ fontSize: '12px', color: '#0D1B3E', padding: '8px 8px 8px 0', maxWidth: '0', width: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</td>
              <td style={{ fontSize: '12px', color: '#0D1B3E', padding: '8px 0', textAlign: 'right' }}>{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DataDetailPage({ params }: { params: Promise<{ id: string; source: string }> }) {
  const { id, source } = use(params)
  const meta = SOURCE_META[source]
  const [days, setDays] = useState(90)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!meta) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/clients/${id}/${meta.endpoint}?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [id, source, days, meta])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Clients" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href={`/dashboard/clients/${id}`} style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← Client</Link>
            <span style={{ color: '#E5E5E3' }}>|</span>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>{meta?.title || 'Data'}</span>
          </div>
          {meta && (
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ padding: '7px 8px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '12px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', background: '#fff', outline: 'none' }}>
              {WINDOWS.map(w => <option key={w.v} value={w.v}>{w.label}</option>)}
            </select>
          )}
        </div>

        <div style={{ padding: '32px', maxWidth: '860px' }}>
          {!meta ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Unknown data source. <Link href={`/dashboard/clients/${id}`} style={{ color: '#6D28D9' }}>Back to client</Link></p>
          ) : loading ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading {meta.title} data...</p>
          ) : !data || data.connected === false ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Not connected, or no data available for this window.</p>
          ) : data.error ? (
            <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#92400E' }}>{data.error}</div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px' }}>
              {source === 'gsc' && data.summary && (
                <>
                  <StatCards stats={[
                    { label: 'Clicks', value: fmt(data.summary.clicks) },
                    { label: 'Impressions', value: fmt(data.summary.impressions) },
                    { label: 'CTR', value: `${data.summary.ctr}%` },
                    { label: 'Avg position', value: data.summary.position },
                  ]} />
                  <BarChart title="Clicks by day" data={(data.daily || []).map((d: any) => ({ date: d.date, value: d.clicks }))} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <SimpleTable title="Top queries" rows={(data.topQueries || []).map((r: any) => ({ label: r.query || '', value: r.clicks }))} />
                    <SimpleTable title="Top pages" rows={(data.topPages || []).map((r: any) => ({ label: r.page || '', value: r.clicks }))} />
                  </div>
                </>
              )}

              {source === 'ga4' && data.summary && (
                <>
                  <StatCards stats={[
                    { label: 'Sessions', value: fmt(data.summary.sessions) },
                    { label: 'Users', value: fmt(data.summary.users) },
                    { label: 'Pageviews', value: fmt(data.summary.pageviews) },
                  ]} />
                  <BarChart title="Sessions by day" data={(data.daily || []).map((d: any) => ({ date: d.date, value: d.sessions }))} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <SimpleTable title="Top landing pages" rows={(data.topPages || []).map((r: any) => ({ label: r.page, value: r.sessions }))} />
                    <SimpleTable title="Traffic channels" rows={(data.channels || []).map((r: any) => ({ label: r.channel, value: r.sessions }))} />
                  </div>
                </>
              )}

              {source === 'callrail' && data.summary && (
                <>
                  <StatCards stats={[
                    { label: 'Total calls', value: fmt(data.summary.totalCalls) },
                    { label: 'Answered', value: fmt(data.summary.answered) },
                    { label: 'First-time', value: fmt(data.summary.firstTime) },
                    { label: 'Avg duration', value: fmtDuration(data.summary.avgDurationSec) },
                  ]} />
                  <BarChart title="Calls by day" data={(data.daily || []).map((d: any) => ({ date: d.date, value: d.calls }))} />
                  <SimpleTable title="Call sources" rows={(data.sources || []).map((r: any) => ({ label: r.source, value: r.calls }))} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
