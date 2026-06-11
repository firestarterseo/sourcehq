import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CALLRAIL_API = 'https://api.callrail.com/v3'

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

// GET: list all companies in the agency CallRail account
export async function GET(_: NextRequest) {
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const agencyKey = process.env.CALLRAIL_AGENCY_KEY
  if (!agencyKey) {
    return NextResponse.json({ available: false, error: 'Agency CallRail key not configured' })
  }

  const headers = { Authorization: `Token token="${agencyKey}"` }

  try {
    const accountsRes = await fetch(`${CALLRAIL_API}/a.json`, { headers })
    if (!accountsRes.ok) {
      return NextResponse.json({ available: false, error: 'Agency CallRail key was rejected' })
    }
    const accountsJson = await accountsRes.json()
    const account = accountsJson.accounts?.[0]
    if (!account) {
      return NextResponse.json({ available: false, error: 'No accounts found for agency key' })
    }

    // Companies can be paginated — pull up to 4 pages of 250
    const companies: { id: string; name: string }[] = []
    for (let page = 1; page <= 4; page++) {
      const res = await fetch(
        `${CALLRAIL_API}/a/${account.id}/companies.json?status=active&per_page=250&page=${page}`,
        { headers }
      )
      if (!res.ok) break
      const json = await res.json()
      for (const c of json.companies || []) {
        companies.push({ id: c.id, name: c.name })
      }
      if (!json.companies || json.companies.length < 250) break
    }

    companies.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      available: true,
      accountId: account.id,
      accountName: account.name,
      companies,
    })
  } catch (err: any) {
    return NextResponse.json({ available: false, error: err.message })
  }
}