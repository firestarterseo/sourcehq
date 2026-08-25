import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    // Build the redirect response FIRST so Supabase can attach Set-Cookie headers to it.
    // `let` because the unauthorized branch below swaps this out for a
    // different redirect once we know whether the session should be kept.
    let response = NextResponse.redirect(new URL(next, request.url))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // /auth/google has no domain restriction, so any Google account can
      // reach this point with a valid, freshly-exchanged session. Only let
      // the redirect to /dashboard through if this person is an actual
      // invited org member (dashboard/layout.tsx checks this too, but that
      // still leaves a signed-in-but-unauthorized session sitting in their
      // browser). Otherwise sign them straight back out here so a random
      // Google account never walks away with a live session at all.
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: member } = await admin
        .from('organization_members')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (member) {
        return response
      }

      response = NextResponse.redirect(new URL('/auth/login?error=unauthorized', request.url))
      await supabase.auth.signOut()
      return response
    }
  }

  return NextResponse.redirect(new URL('/', request.url))
}
