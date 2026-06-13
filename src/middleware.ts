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
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Run on everything except static assets and the auth callback routes,
    // so every page/data request keeps the session fresh.
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
