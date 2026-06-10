import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  await supabase.auth.signOut()

  const response = NextResponse.redirect('https://sourcehq.vercel.app')
  
  // Clear all auth cookies
  cookieStore.getAll().forEach(cookie => {
    if (cookie.name.includes('auth') || cookie.name.includes('supabase')) {
      response.cookies.delete(cookie.name)
    }
  })

  return response
}
