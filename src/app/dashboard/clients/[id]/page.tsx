'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import GenerateReportButton from '@/components/GenerateReportButton'
import DataSourceTiles from '@/components/DataSourceTiles'
import VisibilityTab from '@/components/VisibilityTab'
import { REGIONS } from '@/lib/regions'
import { Search, BarChart3, Phone, Link2 } from 'lucide-react'

interface Client {
  id: string
  name: string
  industry: string
  website: string
  region?: string
  active: boolean
  created_at: string
}

interface ReportRow {
  id: string
  title: string
  period: string | null
  created_at: string
}

interface PropertyOptions {
  connected: boolean
  multiAccount?: boolean
  gscSites?: { url: string; account: string }[]
  ga4Properties?: { id: string; name: string; account: string }[]
  selected?: { gsc: string | null; ga4: string | null; account?: string | null }
}

interface CallRailData { connected: boolean; accountName?: string }
interface CallRailCompany { id: string; name: string; accountId: string; accountName: string }
interface CallRailCompanies { available: boolean; error?: string; accounts?: { id: string; name: string }[]; companies?: CallRailCompany[] }

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
  'Other',
]

const selectStyle = {
  width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px',
  fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff',
} as const
const inputStyle = selectStyle

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
  const [form, setForm] = useState({ name: '', industry: '', website: '', region: '' })
  const [activeTab, setActiveTab] = useState<'overview' | 'visibility' | 'content' | 'sources'>('visibility')

  const [reports, setReports] = useState<ReportRow[] | null>(null)
  const [confirmReportId, setConfirmReportId] = useState<string | null>(null)
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)

  const [googleConnected, setGoogleConnected] = useState(false)
  const [options, setOptions] = useState<PropertyOptions | null>(null)
  const [propsLoaded, setPropsLoaded] = useState(false)
  const [selGsc, setSelGsc] = useState('')
  const [selGa4, setSelGa4] = useState('')
  const [savingProps, setSavingProps] = useState(false)
  const [gbpLocations, setGbpLocations] = useState<{ available: boolean; pending?: boolean; error?: string; locations?: { id: string; name: string }[] } | null>(null)
  const [selGbp, setSelGbp] = useState('')
  const [showGooglePicker, setShowGooglePicker] = useState(false)

  const [callrail, setCallrail] = useState<CallRailData | null>(null)
  const [crCompanies, setCrCompanies] = useState<CallRailCompanies | null>(null)
  const [showCallrailForm, setShowCallrailForm] = useState(false)
  const [crMode, setCrMode] = useState<'agency' | 'standalone'>('agency')
  const [crCompanyId, setCrCompanyId] = useState('')
  const [callrailKey, setCallrailKey] = useState('')
  const [callrailSaving, setCallrailSaving] = useState(false)
  const [callrailError, setCallrailError] = useState('')

  function loadReports() {
    fetch(`/api/clients/${id}/report`)
      .then(r => r.json())
      .then(data => setReports(data.reports || []))
      .catch(() => setReports([]))
  }

  function loadCallrail() {
    fetch(`/api/clients/${id}/callrail`)
      .then(r => r.json())
      .then(data => setCallrail(data))
      .catch(() => setCallrail(null))
  }

  // On page load: CHEAP, database-only status. Does NOT enumerate Google
  // properties - that route refreshes tokens and paginates GA4 across accounts
  // and can be slow; running it on every client page load is what previously
  // blanked the tiles. The heavy property list loads lazily when the picker opens.
  function loadConnections() {
    fetch(`/api/clients/${id}/connection-status`)
      .then(r => r.json())
      .then(data => { setGoogleConnected(!!data.google) })
      .catch(() => setGoogleConnected(false))

    loadCallrail()
  }

  // Heavy: full Google property enumeration + GBP locations. Only called when
  // the Google picker is opened, never on initial page load.
  function loadGoogleProperties() {
    fetch(`/api/clients/${id}/google-properties`)
      .then(r => r.json())
      .then(data => {
        setOptions(data)
        setPropsLoaded(true)
        if (data.connected) setGoogleConnected(true)
        if (data.selected?.gsc) setSelGsc(data.selected.gsc)
        if (data.selected?.ga4) setSelGa4(data.selected.ga4)
      })
      .catch(() => { setOptions(null); setPropsLoaded(true) })

    fetch(`/api/clients/${id}/gbp-locations`).then(r => r.json()).then(d => { setGbpLocations(d); if (d.selected) setSelGbp(d.selected) }).catch(() => setGbpLocations(null))
  }

  // Heavy: CallRail company list. Only when the CallRail form opens.
  function loadCallrailCompanies() {
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
          setForm({ name: data.client.name, industry: data.client.industry || '', website: data.client.website || '', region: data.client.region || '' })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    loadReports()
    loadConnections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Lazy-load the heavy Google property list the first time the picker opens.
  useEffect(() => {
    if (showGooglePicker && !propsLoaded) loadGoogleProperties()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGooglePicker])

  // Lazy-load CallRail companies the first time the CallRail form opens.
  useEffect(() => {
    if (showCallrailForm && !crCompanies) loadCallrailCompanies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCallrailForm])

  async function handleSaveProperties() {
    setSavingProps(true)
    const ga4Name = options?.ga4Properties?.find((p: any) => p.id === selGa4)?.name || null
      const gAccount = options?.ga4Properties?.find((p: any) => p.id === selGa4)?.account || options?.gscSites?.find((s: any) => s.url === selGsc)?.account || null
    await fetch(`/api/clients/${id}/google-properties`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gsc_property: selGsc || null, ga4_property: selGa4 || null, ga4_property_name: ga4Name, google_account: gAccount }),
    })
    setSavingProps(false)
    const gbpName = gbpLocations?.locations?.find(l => l.id === selGbp)?.name || null; await fetch(`/api/clients/${id}/gbp-locations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gbp_location: selGbp || null, gbp_location_name: gbpName }) }); setShowGooglePicker(false)
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
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setCallrailError(data.error || 'Failed to connect'); setCallrailSaving(false); return }
    setCallrailKey(''); setCrCompanyId(''); setShowCallrailForm(false); setCallrailSaving(false); setCallrail(null)
    loadCallrail()
  }

  async function handleDisconnectCallrail() {
    await fetch(`/api/clients/${id}/callrail`, { method: 'DELETE' })
    setCallrail({ connected: false })
  }

  async function handleSave() {
    if (!form.name) return
    setSaving(true); setError('')
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return }
    setClient(data.client); setEditing(false); setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) { router.push('/dashboard/clients'); router.refresh() }
    else { setError('Failed to delete client'); setDeleting(false); setShowDeleteConfirm(false) }
  }

  async function handleDeleteReport(reportId: string) {
    setDeletingReportId(reportId)
    const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
    if (res.ok) setReports(prev => (prev || []).filter(r => r.id !== reportId))
    setDeletingReportId(null); setConfirmReportId(null)
  }

  const crConnected = !!callrail?.connected
  const hasAnySource = googleConnected || crConnected

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

  const tileBase = { background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '8px', minHeight: '96px' }
  const dot = (on: boolean) => ({ width: '8px', height: '8px', borderRadius: '50%', background: on ? '#10B981' : '#D1D5DB', flexShrink: 0 })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Clients" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <Link href="/dashboard/clients" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', flexShrink: 0 }}>← Clients</Link>
            <span style={{ color: '#E5E5E3' }}>|</span>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>{client.name}</span>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{client.industry || 'No industry'}{client.website ? ` · ${client.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setEditing(true)} style={{ background: 'transparent', color: '#6D28D9', border: '0.5px solid #6D28D9', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Edit</button>
            <button onClick={() => setShowDeleteConfirm(true)} style={{ background: 'transparent', color: '#DC2626', border: '0.5px solid #DC2626', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Delete</button>
          </div>
        </div>

        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', display: 'flex', gap: '26px' }}>
          {(['overview','visibility','content','sources'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '14px 2px', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', color: activeTab === t ? '#0D1B3E' : '#6B7280', fontWeight: activeTab === t ? '600' : '400', borderBottom: activeTab === t ? '2px solid #6D28D9' : '2px solid transparent' }}>{t === 'overview' ? 'Overview' : t === 'visibility' ? 'Visibility' : t === 'content' ? 'Content' : 'Data Sources'}</button>
          ))}
        </div>

        <div style={{ padding: '32px', maxWidth: '1080px' }}>          {error && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#991B1B' }}>{error}</div>}

          {showDeleteConfirm && (
            <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: '600', color: '#991B1B', marginBottom: '8px' }}>Delete {client.name}?</h3>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>This permanently deletes the client and all associated data. This cannot be undone.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleDelete} disabled={deleting} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{deleting ? 'Deleting...' : 'Yes, delete'}</button>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              </div>
            </div>
          )}

          {editing && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: '600', color: '#0D1B3E', marginBottom: '16px' }}>Edit client</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Client name *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
                <div><label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Industry</label><select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} style={selectStyle}><option value="">Select industry...</option>{industries.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
                <div><label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Region / market</label><select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={selectStyle}><option value="">Select region...</option>{REGIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
                <div><label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', marginBottom: '6px' }}>Website</label><input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSave} disabled={saving || !form.name} style={{ background: saving || !form.name ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{saving ? 'Saving...' : 'Save changes'}</button>
                  <button onClick={() => { setEditing(false); setForm({ name: client.name, industry: client.industry || '', website: client.website || '', region: client.region || '' }) }} style={{ background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '36px', textAlign: 'center' }}><p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>Overview coming soon.</p></div>
          )}

          {activeTab === 'visibility' && <VisibilityTab clientId={id} />}

          {activeTab === 'content' && (<>
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '20px 24px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: '600', margin: '0 0 2px', color: '#0D1B3E' }}>Generate a publication</p>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{hasAnySource ? "Turn this client's data into citable research" : 'Connect a data source below to generate your first publication'}</p>
              </div>
              {hasAnySource
                ? <GenerateReportButton clientId={id} />
                : <span style={{ fontSize: '12px', color: '#9CA3AF' }}>No data sources yet</span>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: '600', color: '#0D1B3E', margin: 0 }}>Publications</h3>
            {reports && reports.length > 0 && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{reports.length} report{reports.length === 1 ? '' : 's'}</span>}
          </div>

          {!reports ? (
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '28px' }}>Loading...</p>
          ) : reports.length === 0 ? (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '32px', textAlign: 'center', marginBottom: '28px' }}>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>No publications yet. {hasAnySource ? 'Use Generate above to create the first one.' : 'Connect a data source to get started.'}</p>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', overflow: 'hidden', marginBottom: '28px' }}>
              {reports.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < reports.length - 1 ? '0.5px solid #F3F4F6' : 'none', gap: '12px' }}>
                  <Link href={`/dashboard/reports/${r.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0D1B3E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{r.period || ''} · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </Link>
                  {confirmReportId === r.id ? (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => handleDeleteReport(r.id)} disabled={deletingReportId === r.id} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{deletingReportId === r.id ? '...' : 'Confirm'}</button>
                      <button onClick={() => setConfirmReportId(null)} style={{ background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E5E3', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmReportId(r.id)} style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: '13px', cursor: 'pointer', flexShrink: 0, padding: '4px 6px' }} title="Delete">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}

          </>)}

          {activeTab === 'sources' && (<>
          <DataSourceTiles
            clientId={id}
            googleConnected={googleConnected}
            googleConnectHref={`/api/auth/google?clientId=${id}`}
            status={{ connected: { gsc: googleConnected, ga4: googleConnected, callrail: crConnected }, detail: { callrail: callrail?.accountName } }}
            onManageGoogle={() => setShowGooglePicker(!showGooglePicker)}
            onManageCallrail={() => { setShowCallrailForm(!showCallrailForm); setCallrailError('') }}
          />

          {showGooglePicker && googleConnected && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '20px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {!propsLoaded ? (
                <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Loading properties...</p>
              ) : !options?.connected ? (
                <p style={{ fontSize: '12px', color: '#92400E', margin: 0 }}>Could not load Google properties. Try again.</p>
              ) : (
              <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Search Console property</label>
                <select value={selGsc} onChange={e => setSelGsc(e.target.value)} style={selectStyle}><option value="">Select a property...</option>{(options.gscSites || []).map((s: any) => <option key={s.url} value={s.url}>{s.url}{options.multiAccount ? ' (' + s.account + ')' : ''}</option>)}</select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Analytics (GA4) property</label>
                <select value={selGa4} onChange={e => setSelGa4(e.target.value)} style={selectStyle}><option value="">Select a property...</option>{(options.ga4Properties || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}{options.multiAccount ? ' (' + p.account + ')' : ''}</option>)}</select>
              </div>
              <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Business Profile location</label>
                  {gbpLocations?.available ? (
                    <select value={selGbp} onChange={e => setSelGbp(e.target.value)} style={selectStyle}><option value="">Select a location...</option>{(gbpLocations.locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                  ) : (
                    <p style={{ fontSize: '12px', color: '#92400E', margin: 0 }}>{gbpLocations?.pending ? 'Business Profile API access pending Google approval.' : (gbpLocations?.error || 'Loading locations...')}</p>
                  )}
                </div>
                <div><button onClick={handleSaveProperties} disabled={savingProps} style={{ background: savingProps ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{savingProps ? 'Saving...' : 'Save properties'}</button></div>
              </>
              )}
            </div>
          )}

          {showCallrailForm && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '20px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {callrailError && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#991B1B' }}>{callrailError}</div>}
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0D1B3E', cursor: 'pointer' }}><input type="radio" checked={crMode === 'agency'} onChange={() => setCrMode('agency')} />Firestarter CallRail access</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0D1B3E', cursor: 'pointer' }}><input type="radio" checked={crMode === 'standalone'} onChange={() => setCrMode('standalone')} />Client has their own</label>
              </div>
              {crMode === 'agency' ? (
                crCompanies?.available ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>CallRail company</label>
                    <select value={crCompanyId} onChange={e => setCrCompanyId(e.target.value)} style={selectStyle}><option value="">Select a company...</option>{(crCompanies.companies || []).map(c => <option key={c.id} value={c.id}>{c.name}{(crCompanies.accounts || []).length > 1 ? ` — ${c.accountName}` : ''}</option>)}</select>
                  </div>
                ) : <p style={{ fontSize: '12px', color: '#92400E' }}>{crCompanies?.error || 'Loading companies...'}</p>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Client&apos;s CallRail API key</label>
                  <input type="password" value={callrailKey} onChange={e => setCallrailKey(e.target.value)} placeholder="From their CallRail Settings → Integrations" style={inputStyle} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><button onClick={handleConnectCallrail} disabled={callrailSaving || (crMode === 'agency' ? !crCompanyId : !callrailKey.trim())} style={{ background: callrailSaving || (crMode === 'agency' ? !crCompanyId : !callrailKey.trim()) ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{callrailSaving ? 'Connecting...' : 'Save & connect'}</button>{crConnected && <button onClick={handleDisconnectCallrail} style={{ background: 'transparent', color: '#DC2626', border: '0.5px solid #DC2626', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Disconnect</button>}</div>
            </div>
          )}
          </>)}
        </div>
      </div>
    </div>
  )
}








