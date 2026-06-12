'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface ReportContent {
  title?: string
  executive_summary?: string
  wins?: string[]
  concerns?: string[]
  opportunities?: string[]
  actions?: string[]
}

interface Report {
  id: string
  title: string
  period: string | null
  created_at: string
  content: ReportContent
  client_id: string
  client_name?: string
}

function Section({ title, items, color, bg }: { title: string; items?: string[]; color: string; bg: string }) {
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

export default function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/reports/${reportId}`)
      .then(r => r.json())
      .then(data => { setReport(data.report || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [reportId])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Reports" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard/reports" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← Reports</Link>
          {report && (
            <>
              <span style={{ color: '#E5E5E3' }}>|</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>{report.title}</span>
            </>
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

              <Section title="Wins" items={report.content.wins} color="#10B981" bg="#D1FAE5" />
              <Section title="Concerns" items={report.content.concerns} color="#F59E0B" bg="#FEF3C7" />
              <Section title="Opportunities" items={report.content.opportunities} color="#6D28D9" bg="#EDE9FE" />
              <Section title="Recommended actions" items={report.content.actions} color="#0D1B3E" bg="#F3F4F6" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
