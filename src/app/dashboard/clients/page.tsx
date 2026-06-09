import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/')

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <div style={{ width: '220px', background: '#0D1B3E', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        <div style={{ padding: '20px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ fontFamily: 'var(--font-outfit), Outfit, sans-serif', fontSize: '18px', fontWeight: '700', color: '#fff', letterSpacing: '-0.01em', margin: 0 }}>
            SOURCE <span style={{ color: '#A78BFA' }}>HQ</span>
          </h1>
        </div>
        <nav style={{ padding: '8px', flex: 1 }}>
          {[
            { label: 'Dashboard', href: '/dashboard', active: false },
            { label: 'Clients', href: '/dashboard/clients', active: true },
            { label: 'Reports', href: '/dashboard/reports', active: false },
            { label: 'Connections', href: '/dashboard/connections', active: false },
            { label: 'Insights', href: '/dashboard/insights', active: false },
            { label: 'Settings', href: '/dashboard/settings', active: false },
          ].map(item => (
            <Link key={item.label} href={item.href} style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', margin: '1px 0', fontSize: '13px', fontWeight: '500', color: item.active ? '#C4B5FD' : 'rgba(255,255,255,0.5)', background: item.active ? 'rgba(109,40,217,0.15)' : 'transparent', textDecoration: 'none' }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '12px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: '#fff', flexShrink: 0 }}>FS</div>
            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Firestarter SEO</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{session.user.email}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Clients</span>
          <Link href="/dashboard/clients/new" style={{ background: '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            + Add client
          </Link>
        </div>

        <div style={{ padding: '24px' }}>
          {clients && clients.length > 0 ? (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', padding: '10px 20px', borderBottom: '0.5px solid #E5E5E3', background: '#FAFAF8' }}>
                {['Client', 'Industry', 'Status', ''].map(h => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: '500', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {clients.map((client: any) => (
                <Link key={client.id} href={`/dashboard/clients/${client.id}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', padding: '14px 20px', borderBottom: '0.5px solid #F3F4F6', alignItems: 'center', textDecoration: 'none', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0D1B3E' }}>{client.name}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{client.website || '—'}</div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#6B7280' }}>{client.industry || '—'}</div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '500', padding: '3px 9px', borderRadius: '20px', background: client.active ? '#EDE9FE' : '#F3F4F6', color: client.active ? '#5B21B6' : '#6B7280' }}>
                      {client.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#D1D5DB', textAlign: 'right' }}>→</div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏢</div>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '600', color: '#0D1B3E', marginBottom: '8px' }}>No clients yet</h3>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>Add your first client to start generating SOURCE reports.</p>
              <Link href="/dashboard/clients/new" style={{ background: '#6D28D9', color: '#fff', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
                + Add your first client
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}