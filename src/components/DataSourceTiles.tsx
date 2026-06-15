'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as Icons from 'lucide-react'
import { DATA_SOURCES, CATEGORY_ORDER, type DataSourceDef, type SourceCategory } from '@/lib/data-sources'

function Icon({ name, size = 17 }: { name: string; size?: number }) {
  const Cmp = (Icons as any)[name] || (Icons as any).Circle
  return <Cmp size={size} />
}

export interface TileStatus {
  // map of source key -> connected boolean
  connected: Record<string, boolean>
  // optional sublabel override per key (e.g. CallRail account name)
  detail?: Record<string, string | undefined>
}

interface Props {
  clientId: string
  status: TileStatus
  googleConnected: boolean
  // called when user clicks Connect on a google-backed source (starts OAuth)
  googleConnectHref: string
  // called when user clicks Connect/Manage on CallRail
  onManageCallrail: () => void
  // called when user clicks Manage on Google (property picker)
  onManageGoogle: () => void
}

export default function DataSourceTiles({ clientId, status, googleConnected, googleConnectHref, onManageCallrail, onManageGoogle }: Props) {
  const [showCatalog, setShowCatalog] = useState(false)

  const isConnected = (s: DataSourceDef) => {
    if (s.status !== 'live') return false
    return !!status.connected[s.key]
  }

  const connectedSources = DATA_SOURCES.filter(isConnected)

  // group connected sources by category, preserving CATEGORY_ORDER
  const grouped: { category: SourceCategory; sources: DataSourceDef[] }[] = []
  for (const cat of CATEGORY_ORDER) {
    const inCat = connectedSources.filter(s => s.category === cat)
    if (inCat.length) grouped.push({ category: cat, sources: inCat })
  }

  const tileBase = { background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '8px', minHeight: '104px' }
  const dot = (on: boolean) => ({ width: '8px', height: '8px', borderRadius: '50%', background: on ? '#10B981' : '#D1D5DB', flexShrink: 0 })
  const iconWrap = (active: boolean) => ({ width: '32px', height: '32px', borderRadius: '8px', background: active ? '#EDE9FE' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#6D28D9' : '#9CA3AF' })
  const linkStyle = { fontSize: '12px', color: '#6D28D9', textDecoration: 'none', fontWeight: 500 } as const
  const manageStyle = { background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 } as const

  function ConnectedTile({ s }: { s: DataSourceDef }) {
    const sub = status.detail?.[s.key] || s.sublabel
    const isGoogle = !!s.googleBacked
    return (
      <div style={tileBase}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={iconWrap(true)}><Icon name={s.icon} /></span>
          <span style={dot(true)} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#0D1B3E' }}>{s.name}</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {s.dataRoute && <Link href={`/dashboard/clients/${clientId}/data/${s.dataRoute}`} style={linkStyle}>View data</Link>}
          {isGoogle
            ? <button onClick={onManageGoogle} style={manageStyle}>Manage</button>
            : s.key === 'callrail'
              ? <button onClick={onManageCallrail} style={manageStyle}>Manage</button>
              : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: 600, color: '#0D1B3E', margin: 0 }}>Data sources</h3>
        <button onClick={() => setShowCatalog(true)} style={{ background: 'transparent', color: '#6D28D9', border: '0.5px solid #6D28D9', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ Add data source</button>
      </div>

      {connectedSources.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px dashed #D1D5DB', borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px' }}>No data sources connected yet.</p>
          <button onClick={() => setShowCatalog(true)} style={{ background: '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Connect your first source</button>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.category} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{group.category}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
              {group.sources.map(s => <ConnectedTile key={s.key} s={s} />)}
            </div>
          </div>
        ))
      )}

      {showCatalog && (
        <div onClick={() => setShowCatalog(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(13,27,62,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', maxWidth: '640px', width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #E5E5E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: 600, color: '#0D1B3E', margin: 0 }}>Add a data source</h3>
              <button onClick={() => setShowCatalog(false)} style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {CATEGORY_ORDER.map(cat => {
                const inCat = DATA_SOURCES.filter(s => s.category === cat)
                if (!inCat.length) return null
                return (
                  <div key={cat} style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{cat}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {inCat.map(s => {
                        const connected = isConnected(s)
                        const soon = s.status === 'soon'
                        return (
                          <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '0.5px solid #E5E5E3', borderRadius: '10px', opacity: soon ? 0.6 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={iconWrap(!soon)}><Icon name={s.icon} /></span>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#0D1B3E' }}>{s.name}</div>
                                <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.sublabel}</div>
                              </div>
                            </div>
                            {connected ? (
                              <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: '#D1FAE5', color: '#065F46' }}>Connected</span>
                            ) : soon ? (
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Coming soon</span>
                            ) : s.googleBacked ? (
                              googleConnected
                                ? <button onClick={() => { setShowCatalog(false); onManageGoogle() }} style={{ background: '#6D28D9', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Set up</button>
                                : <a href={googleConnectHref} style={{ background: '#6D28D9', color: '#fff', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 500, textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}>Connect Google</a>
                            ) : s.key === 'callrail' ? (
                              <button onClick={() => { setShowCatalog(false); onManageCallrail() }} style={{ background: '#6D28D9', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Connect</button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
