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
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center' }}>
          <Link href="/dashboard/clients" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', marginRight: '12px' }}>â† Clients</Link>
          <span style={{ color: '#E5E5E3', marginRight: '12px' }}>|</span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Add client</span>
        </div>
        <div style={{ padding: '32px', maxWidth: '600px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0D1B3E', marginBottom: '6px' }}>New client</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '32px' }}>Add a client to start connecting data sources and generating reports.</p>
          {error && (
            <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#991B1B' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Client name *</label>
              <input type="text" placeholder="e.g. Denver HVAC Co." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Industry</label>
              <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff' }}>
                <option value="">Select industry...</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Region / market</label>
                <select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff' }}>
                  <option value="">Select region...</option>
                  {REGIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Website</label>
              <input type="text" placeholder="e.g. https://denverheating.com" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
              <button onClick={handleSubmit} disabled={loading || !form.name} style={{ background: loading || !form.name ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', cursor: loading || !form.name ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                {loading ? 'Saving...' : 'Save client'}
              </button>
              <Link href="/dashboard/clients" style={{ padding: '10px 24px', fontSize: '13px', fontWeight: '500', color: '#6B7280', textDecoration: 'none', border: '0.5px solid #E5E5E3', borderRadius: '8px', display: 'inline-flex', alignItems: 'center' }}>
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}





