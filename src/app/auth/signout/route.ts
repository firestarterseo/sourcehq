import { NextResponse } from 'next/server'

export async function GET() {
  const response = NextResponse.redirect('https://sourcehq.vercel.app')
  
  // Clear all Supabase auth cookies
  const cookieNames = [
    'sb-pmddszggtjfwrkkepmrx-auth-token',
    'sb-pmddszggtjfwrkkepmrx-auth-token.0',
    'sb-pmddszggtjfwrkkepmrx-auth-token.1',
    'sb-access-token',
    'sb-refresh-token',
  ]
  
  cookieNames.forEach(name => {
    response.cookies.set(name, '', {
      expires: new Date(0),
      path: '/',
    })
  })

  return response
}