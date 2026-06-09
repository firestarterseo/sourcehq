import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ width: '220px', background: '#0D1B3E', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        <div style={{ padding: '20px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '700', color: '#fff', letterSpacing: '-0.01em', margin: 0 }}>
            SOURCE <span style={{ color: '#A78BFA' }}>HQ</span>
          </h1>
        </div>
        <nav style={{ padding: '8px', flex: 1 }}>
          {[
            { label: 'Dashboard', active: true },
            { label: 'Clients', active: false },
            { label: 'Reports', active: false },
            { label: 'Connections', active: false },
            { label: 'Insights', active: false },
            { label: 'Settings', active: false },
          ].map(item => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: '6px', margin: '1px 0', fontSize: '13px', fontWeight: '500', color: item.active ? '#C4B5FD' : 'rgba(255,255,255,0.5)', background: item.active ? 'rgba(109,40,217,0.15)' : 'transparent', cursor: 'pointer' }}>
              {item.label}
            </div>
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
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Dashboard</span>
        </div>
        <div style={{ padding: '32px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: '700', color: '#0D1B3E', marginBottom: '8px' }}>Welcome to SOURCE HQ</h2>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '32px' }}>Your intelligence platform is ready. Let&#39;s connect your first client.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
            {[
              { label: 'Active clients', value: '0' },
              { label: 'Reports generated', value: '0' },
              { label: 'Data connections', value: '0' },
              { label: 'Pending approvals', value: '0' },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>{stat.label}</div>
                <div style={{ fontSize: '24px', fontWeight: '600', color: '#0D1B3E', fontFamily: 'Outfit, sans-serif' }}>{stat.value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>No clients yet. Add your first client to get started.</p>
            <button style={{ background: '#6D28D9', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              + Add your first client
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}