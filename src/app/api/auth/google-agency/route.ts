import { NextRequest, NextResponse } from 'next/server'

export async function GET(_: NextRequest) {
  const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: 'https://sourcehq.vercel.app/api/auth/google-agency/callback',
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'select_account consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}



