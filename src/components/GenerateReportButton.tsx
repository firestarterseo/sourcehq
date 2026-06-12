'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateReportButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setGenerating(true)
    setError('')
    const res = await fetch(`/api/clients/${clientId}/report`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to generate report')
      setGenerating(false)
      return
    }
    router.push(`/dashboard/reports/${data.report.id}`)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {error && <span style={{ fontSize: '12px', color: '#DC2626' }}>{error}</span>}
      <button
        onClick={generate}
        disabled={generating}
        style={{
          background: generating ? '#9CA3AF' : '#6D28D9',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '7px 16px',
          fontSize: '13px',
          fontWeight: '500',
          cursor: generating ? 'default' : 'pointer',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {generating ? 'Generating... (~20 sec)' : 'Generate Report'}
      </button>
    </div>
  )
}
