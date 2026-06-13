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
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(data => setReports(data.reports || []))
      .catch(() => setReports([]))
  }, [])

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setReports(prev => (prev || []).filter(r => r.id !== id))
    }
    setDeletingId(null)
    setConfirmId(null)
  }

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
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '0' }}>Open a client and click Generate to create your first SOURCE report.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', overflow: 'hidden' }}>
              {reports.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: i < reports.length - 1 ? '0.5px solid #F3F4F6' : 'none', gap: '12px' }}>
                  <Link href={`/dashboard/reports/${r.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0D1B3E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                      {r.client_name ? `${r.client_name} · ` : ''}{r.period || ''}
                    </div>
                  </Link>

                  <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>

                  {confirmId === r.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                        {deletingId === r.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmId(null)} style={{ background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E5E3', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(r.id)} style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0, padding: '4px 6px' }} title="Delete report">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
