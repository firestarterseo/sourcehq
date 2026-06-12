'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import GenerateReportButton from '@/components/GenerateReportButton'

interface Client {
  id: string
  name: string
  industry: string
  website: string
  active: boolean
  created_at: string
}

interface GscRow {
  query?: string
  page?: string
  clicks: number
  impressions: number
  ctr: string
  position: string
}

interface GscData {
  connected: boolean
  revoked?: boolean
  needsSelection?: boolean
  error?: string
  property?: string
  summary?: {
    clicks: number
    impressions: number
    ctr: string
    position: string
    period: string
  }
  daily?: { date: string; clicks: number; impressions: number }[]
  topQueries?: GscRow[]
  topPages?: GscRow[]
}

interface Ga4Data {
  connected: boolean
  revoked?: boolean
  needsSelection?: boolean
  error?: string
  propertyName?: string
  summary?: {
    sessions: number
    users: number
    pageviews: number
    period: string
  }
  daily?: { date: string; sessions: number }[]
  topPages?: { page: string; sessions: number }[]
  channels?: { channel: string; sessions: number }[]
}

interface CallRailData {
  connected: boolean
  error?: string
  accountName?: string
  summary?: {
    totalCalls: number
    answered: number
    missed: number
    firstTime: number
    avgDurationSec: number
    period: string
  }
  daily?: { date: string; calls: number }[]
  sources?: { source: string; calls: number }[]
}

interface CallRailCompany {
  id: string
  name: string
  accountId: string
  accountName: string
}

interface CallRailCompanies {
  available: boolean
  error?: string
  accounts?: { id: string; name: string }[]
  companies?: CallRailCompany[]
}

interface PropertyOptions {
  connected: boolean
  gscSites?: string[]
  ga4Properties?: { id: string; name: string }[]
  selected?: { gsc: string | null; ga4: string | null }
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

function BarChart({ title, data }: { title: string; data: { date: string; value: number }[] }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0D1B3E', marginBottom: '10px' }}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px', padding: '12px', background: '#FAFAF8', borderRadius: '10px', border: '0.5px solid #F3F4F6' }}>
        {data.map(d => (
          <div
            key={d.date}
            title={`${fmtDate(d.date)}: ${d.value.toLocaleString('en-US')}`}
            style={{
              flex: 1,
              height: `${Math.max((d.value / max) * 100, 2)}%`,
              background: '#6D28D9',
              borderRadius: '3px 3px 0 0',
              minWidth: '2px',
              cursor: 'default',
              opacity: 0.85,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 12px' }}>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{fmtDate(data[0].date)}</span>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{fmtDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  )
}

function StatCards({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`, gap: '12px', marginBottom: '24px' }}>
      {stats.map(stat => (
        <div key={stat.label} style={{ background: '#EDE9FE', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{stat.label}</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: '600', color: '#0D1B3E' }}>{stat.value}</div>
        </div>
      ))}
    </div>
  )
}

function SimpleTable({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const fmt = (n: number) => n.toLocaleString('en-US')
  return (
    <div>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0D1B3E', marginBottom: '10px' }}>{title}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.length === 0 && (
            <tr><td style={{ fontSize: '12px', color: '#9CA3AF', padding: '12px 0', textAlign: 'center' }}>No data yet</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '0.5px solid #F3F4F6' }}>
              <td style={{ fontSize: '12px', color: '#0D1B3E', padding: '8px 8px 8px 0', maxWidth: '0', width: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</td>
              <td style={{ fontSize: '12px', color: '#0D1B3E', padding: '8px 0', textAlign: 'right' }}>{fmt(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '0.5px solid #E5E5E3',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#0D1B3E',
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
  background: '#fff',
} as const

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '0.5px solid #E5E5E3',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#0D1B3E',
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
  background: '#fff',
} as const

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
  const [gsc, setGsc] = useState<GscData | null>(null)
  const [gscLoading, setGscLoading] = useState(true)
  const [ga4, setGa4] = useState<Ga4Data | null>(null)
  const [options, setOptions] = useState<PropertyOptions | null>(null)
  const [selGsc, setSelGsc] = useState('')
  const [selGa4, setSelGa4] = useState('')
  const [savingProps, setSavingProps] = useState(false)
  const [callrail, setCallrail] = useState<CallRailData | null>(null)
  const [crCompanies, setCrCompanies] = useState<CallRailCompanies | null>(null)
  const [showCallrailForm, setShowCallrailForm] = useState(false)
  const [crMode, setCrMode] = useState<'agency' | 'standalone'>('agency')
  const [crCompanyId, setCrCompanyId] = useState('')
  const [callrailKey, setCallrailKey] = useState('')
  const [callrailSaving, setCallrailSaving] = useState(false)
  const [callrailError, setCallrailError] = useState('')

  function loadCallrail() {
    fetch(`/api/clients/${id}/callrail`)
      .then(r => r.json())
      .then(data => setCallrail(data))
      .catch(() => setCallrail(null))
  }

  function loadData() {
    fetch(`/api/clients/${id}/gsc`)
      .then(r => r.json())
      .then(data => { setGsc(data); setGscLoading(false) })
      .catch(() => { setGsc(null); setGscLoading(false) })

    fetch(`/api/clients/${id}/ga4`)
      .then(r => r.json())
      .then(data => setGa4(data))
      .catch(() => setGa4(null))

    fetch(`/api/clients/${id}/google-properties`)
      .then(r => r.json())
      .then(data => {
        setOptions(data)
        if (data.selected?.gsc) setSelGsc(data.selected.gsc)
        if (data.selected?.ga4) setSelGa4(data.selected.ga4)
      })
      .catch(() => setOptions(null))

    loadCallrail()

    fetch(`/api/clients/${id}/callrail/companies`)
      .then(r => r.json())
      .then(data => setCrCompanies(data))
      .catch(() => setCrCompanies(null))
  }

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

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSaveProperties() {
    setSavingProps(true)
    const ga4Name = options?.ga4Properties?.find(p => p.id === selGa4)?.name || null
    await fetch(`/api/clients/${id}/google-properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gsc_property: selGsc || null,
        ga4_property: selGa4 || null,
        ga4_property_name: ga4Name,
      }),
    })
    setGscLoading(true)
    setGsc(null)
    setGa4(null)
    loadData()
    setSavingProps(false)
  }

  async function handleConnectCallrail() {
    setCallrailSaving(true)
    setCallrailError('')

    let body: any
    if (crMode === 'agency') {
      if (!crCompanyId) { setCallrailSaving(false); return }
      const company = (crCompanies?.companies || []).find(c => c.id === crCompanyId)
      body = { company_id: crCompanyId, company_name: company?.name || null, account_id: company?.accountId || null }
    } else {
      if (!callrailKey.trim()) { setCallrailSaving(false); return }
      body = { api_key: callrailKey.trim() }
    }

    const res = await fetch(`/api/clients/${id}/callrail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setCallrailError(data.error || 'Failed to connect')
      setCallrailSaving(false)
      return
    }
    setCallrailKey('')
    setCrCompanyId('')
    setShowCallrailForm(false)
    setCallrailSaving(false)
    setCallrail(null)
    loadCallrail()
  }

  async function handleDisconnectCallrail() {
    await fetch(`/api/clients/${id}/callrail`, { method: 'DELETE' })
    setCallrail({ connected: false })
  }

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
    if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return }
    setClient(data.client)
    setEditing(false)
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) { router.push('/dashboard/clients'); router.refresh() }
    else { setError('Failed to delete client'); setDeleting(false); setShowDeleteConfirm(false) }
  }

  const isConnected = !!gsc?.connected
  const crConnected = !!callrail?.connected
  const fmt = (n: number) => n.toLocaleString('en-US')
  const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  const selectionDirty =
    (selGsc || '') !== (options?.selected?.gsc || '') ||
    (selGa4 || '') !== (options?.selected?.ga4 || '')

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Clients" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading...</p>
      </div>
    </div>
  )

  if (!client) return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Clients" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>Client not found. <Link href="/dashboard/clients" style={{ color: '#6D28D9' }}>Go back</Link></p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Clients" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/dashboard/clients" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← Clients</Link>
            <span style={{ color: '#E5E5E3' }}>|</span>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>{client.name}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <GenerateReportButton clientId={id} />
            {!editing && (
              <>
                <button onClick={() => setEditing(true)} style={{ background: 'transparent', color: '#6D28D9', border: '0.5px solid #6D28D9', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Edit</button>
                <button onClick={() => setShowDeleteConfirm(true)} style={{ background: 'transparent', color: '#DC2626', border: '0.5px solid #DC2626', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Delete</button>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: '32px', maxWidth: '900px' }}>
          {error && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#991B1B' }}>{error}</div>}

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
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Industry</label>
                  <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} style={selectStyle}>
                    <option value="">Select industry...</option>
                    {industries.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Website</label>
                  <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} style={inputStyle} />
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

          <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E', marginBottom: '8px' }}>Data connections</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>Connect data sources to start generating SOURCE reports.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ padding: '12px 16px', border: '0.5px solid #E5E5E3', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#10B981' : '#D1D5DB', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0D1B3E' }}>Google (GSC, GA4, GBP, Ads)</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                        {gscLoading ? 'Checking connection...' : isConnected ? 'Connected' : gsc?.revoked ? 'Access revoked — reconnect needed' : 'Search Console · Analytics · Business Profile · Ads'}
                      </div>
                    </div>
                  </div>
                  {isConnected ? (
                    <span style={{ fontSize: '11px', fontWeight: '500', padding: '3px 9px', borderRadius: '20px', background: '#D1FAE5', color: '#065F46' }}>Connected</span>
                  ) : (
                    <a href={`/api/auth/google?clientId=${id}`} style={{ background: '#6D28D9', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                      {gsc?.revoked ? 'Reconnect Google' : 'Connect Google'}
                    </a>
                  )}
                </div>

                {isConnected && options?.connected && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '0.5px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Search Console property</label>
                      <select value={selGsc} onChange={e => setSelGsc(e.target.value)} style={selectStyle}>
                        <option value="">Select a property...</option>
                        {(options.gscSites || []).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Analytics (GA4) property</label>
                      <select value={selGa4} onChange={e => setSelGa4(e.target.value)} style={selectStyle}>
                        <option value="">Select a property...</option>
                        {(options.ga4Properties || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {selectionDirty && (
                      <div>
                        <button onClick={handleSaveProperties} disabled={savingProps} style={{ background: savingProps ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          {savingProps ? 'Saving...' : 'Save & reload data'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 16px', border: '0.5px solid #E5E5E3', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: crConnected ? '#10B981' : '#D1D5DB', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0D1B3E' }}>CallRail</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                        {crConnected ? `Connected${callrail?.accountName ? ` · ${callrail.accountName}` : ''}` : 'Call tracking & attribution'}
                      </div>
                    </div>
                  </div>
                  {crConnected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', padding: '3px 9px', borderRadius: '20px', background: '#D1FAE5', color: '#065F46' }}>Connected</span>
                      <button onClick={handleDisconnectCallrail} style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'underline' }}>Disconnect</button>
                    </div>
                  ) : (
                    <button onClick={() => { setShowCallrailForm(!showCallrailForm); setCallrailError('') }} style={{ background: '#6D28D9', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      Connect CallRail
                    </button>
                  )}
                </div>

                {!crConnected && showCallrailForm && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '0.5px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {callrailError && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#991B1B' }}>{callrailError}</div>}

                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0D1B3E', cursor: 'pointer' }}>
                        <input type="radio" checked={crMode === 'agency'} onChange={() => setCrMode('agency')} />
                        Firestarter CallRail access
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0D1B3E', cursor: 'pointer' }}>
                        <input type="radio" checked={crMode === 'standalone'} onChange={() => setCrMode('standalone')} />
                        Client has their own CallRail
                      </label>
                    </div>

                    {crMode === 'agency' ? (
                      crCompanies?.available ? (
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>CallRail company</label>
                          <select value={crCompanyId} onChange={e => setCrCompanyId(e.target.value)} style={selectStyle}>
                            <option value="">Select a company...</option>
                            {(crCompanies.companies || []).map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name}{(crCompanies.accounts || []).length > 1 ? ` — ${c.accountName}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <p style={{ fontSize: '12px', color: '#92400E' }}>{crCompanies?.error || 'Loading companies...'}</p>
                      )
                    ) : (
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Client&apos;s CallRail API key</label>
                        <input
                          type="password"
                          value={callrailKey}
                          onChange={e => setCallrailKey(e.target.value)}
                          placeholder="From their CallRail Settings → Integrations"
                          style={inputStyle}
                        />
                      </div>
                    )}

                    <div>
                      <button
                        onClick={handleConnectCallrail}
                        disabled={callrailSaving || (crMode === 'agency' ? !crCompanyId : !callrailKey.trim())}
                        style={{ background: callrailSaving || (crMode === 'agency' ? !crCompanyId : !callrailKey.trim()) ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        {callrailSaving ? 'Connecting...' : 'Save & connect'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {['Ahrefs', 'SEMrush'].map(source => (
                <div key={source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '0.5px solid #E5E5E3', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#0D1B3E' }}>{source}</span>
                  <span style={{ fontSize: '11px', fontWeight: '500', padding: '3px 9px', borderRadius: '20px', background: '#F3F4F6', color: '#6B7280' }}>Not connected</span>
                </div>
              ))}
            </div>
          </div>

          {isConnected && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E' }}>Search Console</h2>
                  {gsc?.property && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{gsc.property}</span>}
                </div>
                {gsc?.summary && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{gsc.summary.period}</span>}
              </div>

              {gsc?.needsSelection ? (
                <p style={{ fontSize: '13px', color: '#6B7280' }}>Choose a Search Console property above to load data.</p>
              ) : gsc?.error ? (
                <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#92400E' }}>{gsc.error}</div>
              ) : gsc?.summary ? (
                <>
                  <StatCards stats={[
                    { label: 'Clicks', value: fmt(gsc.summary.clicks) },
                    { label: 'Impressions', value: fmt(gsc.summary.impressions) },
                    { label: 'CTR', value: `${gsc.summary.ctr}%` },
                    { label: 'Avg position', value: gsc.summary.position },
                  ]} />

                  <BarChart title="Clicks by day" data={(gsc.daily || []).map(d => ({ date: d.date, value: d.clicks }))} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <SimpleTable title="Top queries" rows={(gsc.topQueries || []).map(r => ({ label: r.query || '', value: r.clicks }))} />
                    <SimpleTable title="Top pages" rows={(gsc.topPages || []).map(r => ({ label: r.page || '', value: r.clicks }))} />
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading Search Console data...</p>
              )}
            </div>
          )}

          {isConnected && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E' }}>Traffic</h2>
                  {ga4?.propertyName && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{ga4.propertyName}</span>}
                </div>
                {ga4?.summary && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{ga4.summary.period}</span>}
              </div>

              {!ga4 ? (
                <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading traffic data...</p>
              ) : ga4.needsSelection ? (
                <p style={{ fontSize: '13px', color: '#6B7280' }}>Choose an Analytics property above to load data.</p>
              ) : ga4.error ? (
                <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#92400E' }}>{ga4.error}</div>
              ) : ga4.summary ? (
                <>
                  <StatCards stats={[
                    { label: 'Sessions', value: fmt(ga4.summary.sessions) },
                    { label: 'Users', value: fmt(ga4.summary.users) },
                    { label: 'Pageviews', value: fmt(ga4.summary.pageviews) },
                  ]} />

                  <BarChart title="Sessions by day" data={(ga4.daily || []).map(d => ({ date: d.date, value: d.sessions }))} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <SimpleTable title="Top landing pages" rows={(ga4.topPages || []).map(r => ({ label: r.page, value: r.sessions }))} />
                    <SimpleTable title="Traffic channels" rows={(ga4.channels || []).map(r => ({ label: r.channel, value: r.sessions }))} />
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '13px', color: '#6B7280' }}>No traffic data available.</p>
              )}
            </div>
          )}

          {crConnected && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E' }}>Calls</h2>
                  {callrail?.accountName && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{callrail.accountName}</span>}
                </div>
                {callrail?.summary && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{callrail.summary.period}</span>}
              </div>

              {callrail?.error ? (
                <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#92400E' }}>{callrail.error}</div>
              ) : callrail?.summary ? (
                <>
                  <StatCards stats={[
                    { label: 'Total calls', value: fmt(callrail.summary.totalCalls) },
                    { label: 'Answered', value: fmt(callrail.summary.answered) },
                    { label: 'First-time callers', value: fmt(callrail.summary.firstTime) },
                    { label: 'Avg duration', value: fmtDuration(callrail.summary.avgDurationSec) },
                  ]} />

                  <BarChart title="Calls by day" data={(callrail.daily || []).map(d => ({ date: d.date, value: d.calls }))} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <SimpleTable title="Call sources" rows={(callrail.sources || []).map(r => ({ label: r.source, value: r.calls }))} />
                    <div />
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading call data...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}