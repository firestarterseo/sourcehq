'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Sidebar from '@/components/Sidebar'

interface AgencyStatus {
  google?: { connected?: boolean; email?: string | null }
  callrail?: { configured?: boolean; accountName?: string }
  error?: string
}

function ConnectionRow({
  name,
  description,
  connected,
  detail,
  action,
}: {
  name: string
  description: string
  connected: boolean
  detail?: string | null
  action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: '0.5px solid #E5E5E3', borderRadius: '10px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: connected ? '#10B981' : '#D1D5DB', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0D1B3E' }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
            {connected && detail ? detail : description}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {connected && <span style={{ fontSize: '11px', fontWeight: '500', padding: '3px 10px', borderRadius: '20px', background: '#D1FAE5', color: '#065F46' }}>Connected</span>}
        {action}
      </div>
    </div>
  )
}

function ConnectionsContent() {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('connected')
  const errorParam = searchParams.get('error')
  const [status, setStatus] = useState<AgencyStatus | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/agency/connections')
      .then(async r => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          setLoadError(data?.error || `Status check failed (${r.status})`)
          setStatus({})
          return
        }
        setStatus(data || {})
      })
      .catch(() => {
        setLoadError('Could not reach the server')
        setStatus({})
      })
  }, [])

  const googleConnected = !!status?.google?.connected
  const googleEmail = status?.google?.email || null
  const callrailConfigured = !!status?.callrail?.configured
  const callrailName = status?.callrail?.accountName || null

  return (
    <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6', minHeight: '100vh' }}>
      <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Connections</span>
      </div>

      <div style={{ padding: '32px', maxWidth: '760px' }}>
        {justConnected === 'google' && (
          <div style={{ background: '#D1FAE5', border: '0.5px solid #A7F3D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#065F46' }}>
            Google connected at the agency level. All clients can now pull from properties this account can see.
          </div>
        )}
        {errorParam && (
          <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#991B1B' }}>
            Google connection failed ({errorParam}). Try again.
          </div>
        )}
        {loadError && (
          <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#92400E' }}>
            {loadError} â€” connection status may be out of date. Try refreshing, or signing out and back in.
          </div>
        )}

        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '20px', fontWeight: '600', color: '#0D1B3E', marginBottom: '6px' }}>Agency connections</h2>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
          Connect once here. Every client can then pull data from these accounts â€” just pick their property or company on the client page. Clients with their own accounts can still be connected individually there.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <ConnectionRow
            name="Google (GSC, GA4, GBP, Ads)"
            description="Connect Firestarter's Google account â€” covers every client property it can access"
            connected={googleConnected}
            detail={googleEmail ? `Connected as ${googleEmail}` : null}
            action={
              <a href="/api/auth/google-agency" style={{ background: googleConnected ? 'transparent' : '#6D28D9', color: googleConnected ? '#6D28D9' : '#fff', border: googleConnected ? '0.5px solid #6D28D9' : 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '500', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                {googleConnected ? 'Reconnect' : 'Connect Google'}
              </a>
            }
          />

          <ConnectionRow
            name="CallRail"
            description="Agency API key — set as CALLRAIL_AGENCY_KEY in Vercel environment variables"
            connected={callrailConfigured}
            detail={callrailName ? `Connected · ${callrailName}` : null}
          />

          <ConnectionRow name="Ahrefs" description="Coming soon — agency API key" connected={false} />
          <ConnectionRow name="SEMrush" description="Coming soon — agency API key" connected={false} />
          <ConnectionRow name="Weather & economic data" description="Coming soon — powers unique SOURCE report insights" connected={false} />
        </div>

        {!status && (
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '16px' }}>Checking connection status...</p>
        )}
      </div>
    </div>
  )
}

export default function ConnectionsPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Connections" email="" />
      <Suspense fallback={<div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }} />}>
        <ConnectionsContent />
      </Suspense>
    </div>
  )
}

