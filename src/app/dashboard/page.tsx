import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Dashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/')

  // Fetch real stats
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, industry, active, created_at')
    .order('created_at', { ascending: false })

  const { data: connections } = await supabase
    .from('data_connections')
    .select('id, status')

  const { data: reports } = await supabase
    .from('reports')
    .select('id, status')

  const activeClients = clients?.filter(c => c.active).length || 0
  const totalConnections = connections?.length || 0
  const totalReports = reports?.length || 0
  const pendingReports = reports?.filter(r => r.status === 'draft' || r.status === 'pending').length || 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ width: '220px', background: '#0D1B3E', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        <div style={{ padding: '20px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>
            SOURCE <span style={{ color: '#A78BFA' }}>HQ</span>
          </h1>
        </div>
        <nav style={{ padding: '8px', flex: 1 }}>
          {[
            { label: 'Dashboard', href: '/dashboard', active: true },
            { label: 'Clients', href: '/dashboard/clients', active: false },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', marginBottom: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: '#fff', flexShrink: 0 }}>FS</div>
            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Firestarter SEO</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{session.user.email}</div>
            </div>
          </div>
          <Link href="/auth/signout" style={{ display: 'block', padding: '7px 12px', borderRadius: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            Sign out
          </Link>
        </div>
      </div>

      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Dashboard</span>
          <Link href="/dashboard/clients/new" style={{ background: '#6D28D9', color: '#fff', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
            + Add client
          </Link>
        </div>

        <div style={{ padding: '32px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: '700', color: '#0D1B3E', marginBottom: '4px' }}>
            Welcome to SOURCE HQ
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '28px' }}>
            Your intelligence platform is ready.
          </p>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
            {[
              { label: 'Active clients', value: activeClients, sub: activeClients === 1 ? '1 client' : `${activeClients} clients`, color: '#6D28D9' },
              { label: 'Reports generated', value: totalReports, sub: totalReports === 0 ? 'None yet' : `${totalReports} total`, color: '#6D28D9' },
              { label: 'Data connections', value: totalConnections, sub: totalConnections === 0 ? 'None connected' : `${totalConnections} active`, color: '#6D28D9' },
              { label: 'Pending approvals', value: pendingReports, sub: pendingReports === 0 ? 'All clear' : `${pendingReports} to review`, color: pendingReports > 0 ? '#D97706' : '#6D28D9' },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '8px', fontWeight: '500' }}>{stat.label}</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#0D1B3E', fontFamily: 'Outfit, sans-serif', marginBottom: '4px' }}>{stat.value}</div>
                <div style={{ fontSize: '11px', color: stat.color, fontWeight: '500' }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Recent clients */}
          {clients && clients.length > 0 ? (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E5E3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#0D1B3E' }}>Recent clients</span>
                <Link href="/dashboard/clients" style={{ fontSize: '13px', color: '#6D28D9', textDecoration: 'none', fontWeight: '500' }}>View all →</Link>
              </div>
              {clients.slice(0, 5).map((client: any) => (
                <Link key={client.id} href={`/dashboard/clients/${client.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid #F3F4F6', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#6D28D9', flexShrink: 0 }}>
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#0D1B3E' }}>{client.name}</div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '1px' }}>{client.industry || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '500', padding: '3px 9px', borderRadius: '20px', background: client.active ? '#EDE9FE' : '#F3F4F6', color: client.active ? '#5B21B6' : '#6B7280' }}>
                      {client.active ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{ color: '#D1D5DB', fontSize: '14px' }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>🏢</div>
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
