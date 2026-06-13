'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  'Gathering search demand data...',
  'Pulling web engagement signals...',
  'Analyzing inbound inquiry patterns...',
  'Correlating economic & weather context...',
  'Writing the publication...',
  'Finalizing citations...',
]

export default function GenerateReportButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [generating, setGenerating] = useState<string | null>(null)
  const [days, setDays] = useState(90)
  const [error, setError] = useState('')
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!generating) { setStepIndex(0); return }
    const timer = setInterval(() => {
      setStepIndex(i => (i < STEPS.length - 1 ? i + 1 : i))
    }, 6000)
    return () => clearInterval(timer)
  }, [generating])

  async function generate(type: 'publication' | 'internal') {
    setGenerating(type)
    setError('')
    setStepIndex(0)
    const res = await fetch(`/api/clients/${clientId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, days }),
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
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {error && <span style={{ fontSize: '12px', color: '#DC2626' }}>{error}</span>}
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          disabled={!!generating}
          style={{ padding: '7px 8px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '12px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', background: '#fff', outline: 'none' }}
        >
          <option value={28}>Last 28 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
          <option value={365}>Last 12 months</option>
          <option value={730}>Last 2 years</option>
        </select>
        <button onClick={() => generate('publication')} disabled={!!generating} style={btn(generating ? '#9CA3AF' : '#6D28D9', 'none', '#fff')}>
          Generate Publication
        </button>
        <button onClick={() => generate('internal')} disabled={!!generating} style={btn('transparent', '0.5px solid #6D28D9', generating ? '#9CA3AF' : '#6D28D9')}>
          Internal Analysis
        </button>
      </div>

      {generating && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(13, 27, 62, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '40px 48px',
            maxWidth: '420px', width: '90%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{
              width: '40px', height: '40px', margin: '0 auto 24px',
              border: '3px solid #EDE9FE', borderTopColor: '#6D28D9',
              borderRadius: '50%', animation: 'sourcehq-spin 0.8s linear infinite',
            }} />
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E', marginBottom: '8px' }}>
              {generating === 'publication' ? 'Generating publication' : 'Running analysis'}
            </h3>
            <p style={{ fontSize: '14px', color: '#6D28D9', fontWeight: '500', marginBottom: '6px', minHeight: '20px' }}>
              {STEPS[stepIndex]}
            </p>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
              This usually takes 30-90 seconds. Please keep this tab open.
            </p>
          </div>
          <style>{`@keyframes sourcehq-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </>
  )
}
