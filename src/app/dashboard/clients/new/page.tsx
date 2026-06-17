'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { REGIONS } from '@/lib/regions'

const industries = [
  'HVAC', 'Plumbing', 'Roofing', 'Electrical', 'Windows & Doors',
  'Painting', 'Landscaping', 'Pest Control', 'Cleaning Services',
  'Dental', 'Medical', 'Chiropractic', 'Veterinary',
  'Legal', 'Accounting', 'Financial Services',
  'Real Estate', 'Mortgage',
  'Restaurant', 'Hospitality',
  'SaaS', 'IT Services', 'Cybersecurity',
  'E-commerce', 'Retail',
  'Digital Marketing / SEO', 'Advertising Agency',
  'Construction', 'General Contractor',
  'Auto Repair', 'Dealership',
  'Education', 'Childcare',
  'Other'
]

const STEP_LABELS = ['Client details', 'Connect Google', 'Connect data', 'Call tracking', 'Generate']

const selectStyle = {
  width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px',
  fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff',
} as const
const inputStyle = selectStyle

function StepDots({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
      {STEP_LABELS.map((label, i) => {
        const isDone = i < current
        const isCurrent = i === current
        const bg = isDone ? '#10B981' : isCurrent ? '#6D28D9' : '#E5E7EB'
        const color = isDone || isCurrent ? '#fff' : '#9CA3AF'
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{isDone ? '✓' : i + 1}</div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: isCurrent ? '#0D1B3E' : '#9CA3AF', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div style={{ flex: 1, height: '1px', background: '#E5E7EB', margin: '0 12px' }} />}
          </div>
        )
      })}
    </div>
  )
}

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', industry: '', website: '', region: '' })

  async function handleSubmit() {
    if (!form.name) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save client')
        setLoading(false)
        return
      }
      router.push('/dashboard/clients/' + data.client.id + '/setup')
      router.refresh()
    } catch (e: any) {
      setError('Unexpected error: ' + e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Clients" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Add a client</span>
          <Link href="/dashboard/clients" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>Cancel</Link>
        </div>

        <div style={{ padding: '40px', maxWidth: '720px', margin: '0 auto' }}>
          <StepDots current={0} />

          <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '16px', padding: '32px' }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '20px', fontWeight: '600', color: '#0D1B3E', margin: '0 0 6px' }}>Client details</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 24px', maxWidth: '560px', lineHeight: 1.5 }}>Start with the basics. You'll connect data sources and generate the first report in the next steps.</p>

            {error && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#991B1B' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Client name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Denver HVAC Co." style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Industry</label>
                <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} style={selectStyle}><option value="">Select industry...</option>{industries.map(i => <option key={i} value={i}>{i}</option>)}</select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Region / market</label>
                <select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={selectStyle}><option value="">Select region...</option>{REGIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Website</label>
                <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="e.g. https://denverheating.com" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={handleSubmit} disabled={loading || !form.name} style={{ background: loading || !form.name ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', cursor: loading || !form.name ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{loading ? 'Saving...' : 'Save & continue →'}</button>
              {!form.name && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Client name is required</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
