'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import GenerateReportButton from '@/components/GenerateReportButton'

const STEP_LABELS = ['Client details', 'Connect Google', 'Connect data', 'Call tracking', 'Generate']

const selectStyle = {
  width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px',
  fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff',
} as const
const inputStyle = selectStyle

const primaryBtn = (disabled: boolean) => ({
  background: disabled ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px',
  padding: '10px 24px', fontSize: '13px', fontWeight: '500' as const, cursor: disabled ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif',
})
const ghostBtn = {
  background: 'transparent', color: '#6B7280', border: '0.5px solid #E5E5E3', borderRadius: '8px',
  padding: '10px 24px', fontSize: '13px', fontWeight: '500' as const, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
}
const skipBtn = {
  background: 'transparent', color: '#6D28D9', border: 'none', fontSize: '13px', fontWeight: '500' as const,
  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'underline',
}

function StepDots({ step, googleDone, dataDone, callrailDone, reportDone }: { step: number; googleDone: boolean; dataDone: boolean; callrailDone: boolean; reportDone: boolean }) {
  // "Client details" is always done by the time the wizard renders (the client exists).
  // The wizard's internal step (0-3) maps to visual index step+1.
  const done = [true, googleDone, dataDone, callrailDone, reportDone]
  const currentVisual = step + 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
      {STEP_LABELS.map((label, i) => {
        const isDone = done[i]
        const isCurrent = i === currentVisual
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

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '20px', fontWeight: '600', color: '#0D1B3E', margin: '0 0 6px' }}>{title}</h2>
      <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 24px', maxWidth: '560px', lineHeight: 1.5 }}>{subtitle}</p>
      {children}
    </div>
  )
}

export default function SetupWizard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)

  const [googleConnected, setGoogleConnected] = useState(false)
  const [gscSites, setGscSites] = useState<{ url: string; account: string }[]>([])
  const [ga4Properties, setGa4Properties] = useState<{ id: string; name: string; account: string }[]>([])
  const [multiAccount, setMultiAccount] = useState(false)
  const [selGsc, setSelGsc] = useState('')
  const [selGa4, setSelGa4] = useState('')
  const [savingProps, setSavingProps] = useState(false)

  const [callrailConnected, setCallrailConnected] = useState(false)
  const [crCompanies, setCrCompanies] = useState<any>(null)
  const [crMode, setCrMode] = useState<'agency' | 'standalone'>('agency')
  const [crCompanyId, setCrCompanyId] = useState('')
  const [callrailKey, setCallrailKey] = useState('')
  const [callrailSaving, setCallrailSaving] = useState(false)
  const [callrailError, setCallrailError] = useState('')

  const [hasReport, setHasReport] = useState(false)

  const hasProperty = !!(selGsc || selGa4)
  const connectGoogleHref = `/api/auth/google?clientId=${id}&next=${encodeURIComponent('/dashboard/clients/' + id + '/setup')}`

  function loadAll(setInitialStep: boolean) {
    Promise.all([
      fetch(`/api/clients/${id}`).then(r => r.json()).catch(() => null),
      fetch(`/api/clients/${id}/google-properties`).then(r => r.json()).catch(() => null),
      fetch(`/api/clients/${id}/callrail`).then(r => r.json()).catch(() => null),
      fetch(`/api/clients/${id}/callrail/companies`).then(r => r.json()).catch(() => null),
      fetch(`/api/clients/${id}/report`).then(r => r.json()).catch(() => null),
    ]).then(([client, gp, cr, crc, rep]) => {
      if (client?.client) setClientName(client.client.name)
      const gConn = !!gp?.connected
      setGoogleConnected(gConn)
      setGscSites(gp?.gscSites || [])
      setGa4Properties(gp?.ga4Properties || [])
      setMultiAccount(!!gp?.multiAccount)
      const gsc = gp?.selected?.gsc || ''
      const ga4 = gp?.selected?.ga4 || ''
      setSelGsc(gsc)
      setSelGa4(ga4)
      setCallrailConnected(!!cr?.connected)
      setCrCompanies(crc)
      const reports = rep?.reports || []
      setHasReport(reports.length > 0)
      if (setInitialStep) {
        let s = 3
        if (!gConn) s = 0
        else if (!(gsc || ga4)) s = 1
        else s = 3
        setStep(s)
      }
      setLoading(false)
    })
  }

  useEffect(() => { loadAll(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  async function saveProperties() {
    setSavingProps(true)
    const ga4Name = ga4Properties.find(p => p.id === selGa4)?.name || null
    const gAccount = ga4Properties.find(p => p.id === selGa4)?.account || gscSites.find(s => s.url === selGsc)?.account || null
    await fetch(`/api/clients/${id}/google-properties`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gsc_property: selGsc || null, ga4_property: selGa4 || null, ga4_property_name: ga4Name, google_account: gAccount }),
    })
    setSavingProps(false)
    setStep(2)
  }

  async function connectCallrail() {
    setCallrailSaving(true); setCallrailError('')
    let body: any
    if (crMode === 'agency') {
      if (!crCompanyId) { setCallrailSaving(false); return }
      const company = (crCompanies?.companies || []).find((c: any) => c.id === crCompanyId)
      body = { company_id: crCompanyId, company_name: company?.name || null, account_id: company?.accountId || null }
    } else {
      if (!callrailKey.trim()) { setCallrailSaving(false); return }
      body = { api_key: callrailKey.trim() }
    }
    const res = await fetch(`/api/clients/${id}/callrail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setCallrailError(data.error || 'Failed to connect'); setCallrailSaving(false); return }
    setCallrailSaving(false); setCallrailConnected(true); setStep(3)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Clients" email="" />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Set up{clientName ? ` ${clientName}` : ''}</span>
          </div>
          <Link href={`/dashboard/clients/${id}`} style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>Exit setup →</Link>
        </div>

        <div style={{ padding: '40px', maxWidth: '720px', margin: '0 auto' }}>
          {loading ? (
            <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading...</p>
          ) : (
            <>
              <StepDots step={step} googleDone={googleConnected} dataDone={hasProperty} callrailDone={callrailConnected} reportDone={hasReport} />

              <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '16px', padding: '32px' }}>
                {step === 0 && (
                  <StepShell title="Connect Google" subtitle="Connect the Google account that has this client's Search Console and Analytics access. This is the one required step — everything else can be added later.">
                    {googleConnected ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                          <span style={{ fontSize: '13px', color: '#0D1B3E', fontWeight: 500 }}>Google connected</span>
                        </div>
                        <button onClick={() => setStep(1)} style={primaryBtn(false)}>Continue</button>
                      </div>
                    ) : (
                      <button onClick={() => { window.location.href = connectGoogleHref }} style={primaryBtn(false)}>Connect Google</button>
                    )}
                  </StepShell>
                )}

                {step === 1 && (
                  <StepShell title="Connect your data" subtitle="Pick the Search Console and/or Analytics property for this client. You need at least one — both is better.">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Search Console property</label>
                        <select value={selGsc} onChange={e => setSelGsc(e.target.value)} style={selectStyle}><option value="">None</option>{gscSites.map(s => <option key={s.url} value={s.url}>{s.url}{multiAccount ? ' (' + s.account + ')' : ''}</option>)}</select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Analytics (GA4) property</label>
                        <select value={selGa4} onChange={e => setSelGa4(e.target.value)} style={selectStyle}><option value="">None</option>{ga4Properties.map(p => <option key={p.id} value={p.id}>{p.name}{multiAccount ? ' (' + p.account + ')' : ''}</option>)}</select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button onClick={() => setStep(0)} style={ghostBtn}>Back</button>
                      <button onClick={saveProperties} disabled={!hasProperty || savingProps} style={primaryBtn(!hasProperty || savingProps)}>{savingProps ? 'Saving...' : 'Continue'}</button>
                      {!hasProperty && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Select at least one property</span>}
                    </div>
                  </StepShell>
                )}

                {step === 2 && (
                  <StepShell title="Call tracking" subtitle="Optional. Connect CallRail to fold inbound calls into this client's research. You can skip this and add it later from the client page.">
                    {callrailConnected ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                          <span style={{ fontSize: '13px', color: '#0D1B3E', fontWeight: 500 }}>CallRail connected</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button onClick={() => setStep(1)} style={ghostBtn}>Back</button>
                          <button onClick={() => setStep(3)} style={primaryBtn(false)}>Continue</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {callrailError && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#991B1B', marginBottom: '16px' }}>{callrailError}</div>}
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0D1B3E', cursor: 'pointer' }}><input type="radio" checked={crMode === 'agency'} onChange={() => setCrMode('agency')} />Firestarter CallRail access</label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0D1B3E', cursor: 'pointer' }}><input type="radio" checked={crMode === 'standalone'} onChange={() => setCrMode('standalone')} />Client has their own</label>
                        </div>
                        {crMode === 'agency' ? (
                          crCompanies?.available ? (
                            <div style={{ marginBottom: '24px' }}>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>CallRail company</label>
                              <select value={crCompanyId} onChange={e => setCrCompanyId(e.target.value)} style={selectStyle}><option value="">Select a company...</option>{(crCompanies.companies || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}{(crCompanies.accounts || []).length > 1 ? ` — ${c.accountName}` : ''}</option>)}</select>
                            </div>
                          ) : <p style={{ fontSize: '12px', color: '#92400E', marginBottom: '24px' }}>{crCompanies?.error || 'Loading companies...'}</p>
                        ) : (
                          <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0D1B3E', marginBottom: '5px' }}>Client&apos;s CallRail API key</label>
                            <input type="password" value={callrailKey} onChange={e => setCallrailKey(e.target.value)} placeholder="From their CallRail Settings → Integrations" style={inputStyle} />
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <button onClick={() => setStep(1)} style={ghostBtn}>Back</button>
                          <button onClick={connectCallrail} disabled={callrailSaving || (crMode === 'agency' ? !crCompanyId : !callrailKey.trim())} style={primaryBtn(callrailSaving || (crMode === 'agency' ? !crCompanyId : !callrailKey.trim()))}>{callrailSaving ? 'Connecting...' : 'Connect & continue'}</button>
                          <button onClick={() => setStep(3)} style={skipBtn}>Skip for now</button>
                        </div>
                      </>
                    )}
                  </StepShell>
                )}

                {step === 3 && (
                  <StepShell title="Generate your first report" subtitle="Everything's connected. Generate the first publication — it usually takes 30–90 seconds, and you'll land on the finished report when it's done.">
                    {hasReport && (
                      <div style={{ background: '#ECFDF5', border: '0.5px solid #A7F3D0', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#065F46', marginBottom: '20px' }}>This client already has at least one report. You can generate another, or head to the client page.</div>
                    )}
                    <GenerateReportButton clientId={id} />
                    <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
                      <button onClick={() => setStep(2)} style={ghostBtn}>Back</button>
                      <Link href={`/dashboard/clients/${id}`} style={{ ...skipBtn, display: 'inline-flex', alignItems: 'center' }}>Finish — go to client page</Link>
                    </div>
                  </StepShell>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
