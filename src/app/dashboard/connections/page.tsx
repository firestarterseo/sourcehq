import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ConnectionsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
if (!session) redirect('/')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ width: '220px', background: '#0D1B3E', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        <div style={{ padding: '20px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>SOURCE <span style={{ color: '#A78BFA' }}>HQ</span></h1>
        </div>
        <nav style={{ padding: '8px', flex: 1 }}>
          {[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Clients', href: '/dashboard/clients' },
            { label: 'Reports', href: '/dashboard/reports' },
            { label: 'Connections', href: '/dashboard/connections' },
            { label: 'Insights', href: '/dashboard/insights' },
            { label: 'Settings', href: '/dashboard/settings' },
          ].map(item => (
            <Link key={item.label} href={item.href} style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', margin: '1px 0', fontSize: '13px', fontWeight: '500', color: item.label === 'Connections' ? '#C4B5FD' : 'rgba(255,255,255,0.5)', background: item.label === 'Connections' ? 'rgba(109,40,217,0.15)' : 'transparent', textDecoration: 'none' }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '12px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', marginBottom: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: '#fff' }}>FS</div>
            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Firestarter SEO</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{session.user.email}</div>
            </div>
          </div>
          <Link href="/auth/signout" style={{ display: 'block', padding: '7px 12px', borderRadius: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Sign out</Link>
        </div>
      </div>
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Connections</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '26px' }}>🔌</div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0D1B3E', marginBottom: '8px' }}>Data connections</h2>
            <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.6', marginBottom: '24px' }}>Connect Google Search Console, GA4, CallRail and more. Manage all your data sources in one place.</p>
            <span style={{ display: 'inline-block', background: '#EDE9FE', color: '#6D28D9', fontSize: '12px', fontWeight: '500', padding: '6px 16px', borderRadius: '20px' }}>Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}