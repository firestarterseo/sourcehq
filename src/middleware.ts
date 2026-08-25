import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Touching getUser() triggers a token refresh when the access token is
  // near/at expiry, and the refreshed cookies are written back onto the response.
  // getUser() (not getSession()) is used because it revalidates the token
  // against Supabase Auth instead of just trusting the cookie payload.
  const { data: { user } } = await supabase.auth.getUser()

  // Gate every /dashboard route here so an unauthenticated request never
  // reaches a page component. This is the primary guard; dashboard/layout.tsx
  // repeats the check server-side as defense in depth.
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    // Run on everything except static assets and the auth callback routes,
    // so every page/data request keeps the session fresh.
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
