'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateReportButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function generate(type: 'publication' | 'internal') {
    setGenerating(type)
    setError('')
    const res = await fetch(`/api/clients/${clientId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to generate')
      setGenerating(null)
      return
    }
    router.push(`/dashboard/reports/${data.report.id}`)
  }

  const btn = (bg: string, border: string, color: string) => ({
    background: bg,
    color,
    border,
    borderRadius: '8px',
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {error && <span style={{ fontSize: '12px', color: '#DC2626' }}>{error}</span>}
      <button
        onClick={() => generate('publication')}
        disabled={!!generating}
        style={btn(generating ? '#9CA3AF' : '#6D28D9', 'none', '#fff')}
      >
        {generating === 'publication' ? 'Writing... (~30 sec)' : 'Generate Publication'}
      </button>
      <button
        onClick={() => generate('internal')}
        disabled={!!generating}
        style={btn('transparent', '0.5px solid #6D28D9', generating ? '#9CA3AF' : '#6D28D9')}
      >
        {generating === 'internal' ? 'Analyzing...' : 'Internal Analysis'}
      </button>
    </div>
  )
}
