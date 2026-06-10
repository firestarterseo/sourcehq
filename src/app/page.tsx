import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Logo from '@/components/Logo'

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
if (user) redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EDE9FE 0%, #E0E7FF 100%)' }}>
      <div className="w-full max-w-md">
        <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', border: '0.5px solid #E5E5E3' }}>
          <div style={{ background: 'linear-gradient(135deg, #EDE9FE 0%, #E0E7FF 100%)', padding: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Logo variant="light" size="md" showTagline={true} />
          </div>
          <div style={{ padding: '28px' }}>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: '#6B7280', textAlign: 'center', marginBottom: '20px' }}>
              Sign in to your workspace
            </p>
            <a href="/auth/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '10px 16px', border: '0.5px solid #E5E5E3', borderRadius: '8px', background: '#fff', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: '500', color: '#0D1B3E', textDecoration: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
              Continue with Google
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
