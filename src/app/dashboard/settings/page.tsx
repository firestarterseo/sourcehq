import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SettingsPage() {
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
            <Link key={item.label} href={item.href} style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', margin: '1px 0', fontSize: '13px', fontWeight: '500', color: item.label === 'Settings' ? '#C4B5FD' : 'rgba(255,255,255,0.5)', background: item.label === 'Settings' ? 'rgba(109,40,217,0.15)' : 'transparent', textDecoration: 'none' }}>
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
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Settings</span>
        </div>
        <div style={{ padding: '32px', maxWidth: '600px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0D1B3E', marginBottom: '24px' }}>Settings</h2>
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E5E3' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0D1B3E', marginBottom: '4px' }}>Account</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>{session.user.email}</div>
            </div>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E5E3' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0D1B3E', marginBottom: '4px' }}>Organization</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>Firestarter SEO</div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0D1B3E', marginBottom: '4px' }}>Plan</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>Internal — Firestarter SEO workspace</div>
            </div>
          </div>
          <Link href="/auth/signout" style={{ display: 'inline-block', background: 'transparent', color: '#DC2626', border: '0.5px solid #DC2626', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
            Sign out
          </Link>
        </div>
      </div>
    </div>
  )
}