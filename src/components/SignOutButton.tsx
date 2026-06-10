'use client'

import { createClient } from '@/lib/supabase'

export default function SignOutButton() {
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = 'https://sourcehq.vercel.app'
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '500',
        color: 'rgba(255,255,255,0.5)',
        textDecoration: 'none',
        border: '0.5px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
        cursor: 'pointer',
        background: 'transparent',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      Sign out
    </button>
  )
}