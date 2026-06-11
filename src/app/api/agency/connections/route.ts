import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAgencyGoogleStatus } from '@/lib/google-auth'

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
  return supabase.auth.getSession()
}

export async function GET(_: NextRequest) {
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const google = await getAgencyGoogleStatus()

  let callrail: { configured: boolean; accountName?: string } = { configured: false }
  if (process.env.CALLRAIL_AGENCY_KEY) {
    try {
      const res = await fetch('https://api.callrail.com/v3/a.json', {
        headers: { Authorization: `Token token="${process.env.CALLRAIL_AGENCY_KEY}"` },
      })
      if (res.ok) {
        const json = await res.json()
        callrail = { configured: true, accountName: json.accounts?.[0]?.name }
      }
    } catch {}
  }

  return NextResponse.json({ google, callrail })
}