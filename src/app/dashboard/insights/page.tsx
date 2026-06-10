import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function InsightsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getSession()
if (!session) redirect('/')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Insights" email={session.user.email!} />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E5E3', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#0D1B3E' }}>Insights</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '26px' }}>✨</div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0D1B3E', marginBottom: '8px' }}>AI-powered insights</h2>
            <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.6', marginBottom: '24px' }}>Cross-channel pattern detection, trend analysis, and citable findings — generated automatically from your connected data.</p>
            <span style={{ display: 'inline-block', background: '#EDE9FE', color: '#6D28D9', fontSize: '12px', fontWeight: '500', padding: '6px 16px', borderRadius: '20px' }}>Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}