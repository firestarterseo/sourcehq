'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface ReportRow {
  id: string
  title: string
  period: string | null
  created_at: string
  client_name: string | null
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRow[] | null>(null)

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(data => setReports(data.reports || []))
      .catch(() => setReports([]))
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Reports" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Reports</span>
        </div>

        <div style={{ padding: '32px', maxWidth: '860px' }}>
          {!reports ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading reports...</p>
          ) : reports.length === 0 ? (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E', marginBottom: '8px' }}>No reports yet</h3>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '0' }}>Open a client and click Generate Report to create your first SOURCE report.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', overflow: 'hidden' }}>
              {reports.map((r, i) => (
                <Link key={r.id} href={`/dashboard/reports/${r.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: i < reports.length - 1 ? '0.5px solid #F3F4F6' : 'none', textDecoration: 'none' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0D1B3E' }}>{r.title}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                      {r.client_name ? `${r.client_name} · ` : ''}{r.period || ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
