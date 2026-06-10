import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  const email = session?.user?.email || ''

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Settings" email={email} />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Settings</span>
        </div>
        <div style={{ padding: '32px', maxWidth: '600px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0D1B3E', marginBottom: '24px' }}>Settings</h2>
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E5E3' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0D1B3E', marginBottom: '4px' }}>Account</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>{email || '—'}</div>
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