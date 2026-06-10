'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  industry: string
  website: string
  active: boolean
  created_at: string
}

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

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', industry: '', website: '' })

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.client) {
          setClient(data.client)
          setForm({
            name: data.client.name,
            industry: data.client.industry || '',
            website: data.client.website || '',
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  async function handleSave() {
    if (!form.name) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to save')
      setSaving(false)
      return
    }
    setClient(data.client)
    setEditing(false)
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/clients')
      router.refresh()
    } else {
      setError('Failed to delete client')
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const sidebar = (
    <div style={{ width: '220px', background: '#0D1B3E', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh' }}>
      <div style={{ padding: '20px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>
          SOURCE <span style={{ color: '#A78BFA' }}>HQ</span>
        </h1>
      </div>
      <nav style={{ padding: '8px', flex: 1 }}>
        {[
          { label: 'Dashboard', href: '/dashboard', active: false },
          { label: 'Clients', href: '/dashboard/clients', active: true },
          { label: 'Reports', href: '/dashboard', active: false },
          { label: 'Connections', href: '/dashboard', active: false },
          { label: 'Insights', href: '/dashboard', active: false },
          { label: 'Settings', href: '/dashboard', active: false },
        ].map(item => (
          <Link key={item.label} href={item.href} style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', margin: '1px 0', fontSize: '13px', fontWeight: '500', color: item.active ? '#C4B5FD' : 'rgba(255,255,255,0.5)', background: item.active ? 'rgba(109,40,217,0.15)' : 'transparent', textDecoration: 'none' }}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      {sidebar}
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading...</p>
      </div>
    </div>
  )

  if (!client) return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      {sidebar}
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>Client not found. <Link href="/dashboard/clients" style={{ color: '#6D28D9' }}>Go back</Link></p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      {sidebar}
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/dashboard/clients" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← Clients</Link>
            <span style={{ color: '#E5E5E3' }}>|</span>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>{client.name}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!editing && (
              <>
                <button onClick={() => setEditing(true)} style={{ background: 'transparent', color: '#6D28D9', border: '0.5px solid #6D28D9', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Edit</button>
                <button onClick={() => setShowDeleteConfirm(true)} style={{ background: 'transparent', color: '#DC2626', border: '0.5px solid #DC2626', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Delete</button>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: '32px', maxWidth: '700px' }}>
          {error && (
            <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#991B1B' }}>{error}</div>
          )}

          {showDeleteConfirm && (
            <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: '600', color: '#991B1B', marginBottom: '8px' }}>Delete {client.name}?</h3>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>This will permanently delete this client and all associated data. This cannot be undone.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleDelete} disabled={deleting} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E', marginBottom: '20px' }}>Client details</h2>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Client name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Industry</label>
                  <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff' }}>
                    <option value="">Select industry...</option>
                    {industries.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Website</label>
                  <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px', fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                  <button onClick={handleSave} disabled={saving || !form.name} style={{ background: saving || !form.name ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button onClick={() => { setEditing(false); setForm({ name: client.name, industry: client.industry || '', website: client.website || '' }) }} style={{ background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { label: 'Client name', value: client.name },
                  { label: 'Industry', value: client.industry || '—' },
                  { label: 'Website', value: client.website || '—' },
                  { label: 'Status', value: client.active ? 'Active' : 'Inactive' },
                  { label: 'Added', value: new Date(client.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', gap: '16px', paddingBottom: '16px', borderBottom: '0.5px solid #F3F4F6' }}>
                    <div style={{ width: '140px', flexShrink: 0, fontSize: '13px', color: '#9CA3AF', fontWeight: '500' }}>{row.label}</div>
                    <div style={{ fontSize: '13px', color: '#0D1B3E' }}>{row.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E', marginBottom: '8px' }}>Data connections</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>Connect data sources to start generating SOURCE reports.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['Google Search Console', 'Google Analytics 4', 'Google Business Profile', 'Google Ads', 'CallRail', 'Ahrefs', 'SEMrush'].map(source => (
                <div key={source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '0.5px solid #E5E5E3', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#0D1B3E' }}>{source}</span>
                  <span style={{ fontSize: '11px', fontWeight: '500', padding: '3px 9px', borderRadius: '20px', background: '#F3F4F6', color: '#6B7280' }}>Not connected</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}