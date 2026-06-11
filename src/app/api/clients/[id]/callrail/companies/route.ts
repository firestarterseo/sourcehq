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

export async function GET(_: NextRequest) {
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const agencyKey = process.env.CALLRAIL_AGENCY_KEY
  if (!agencyKey) {
    return NextResponse.json({ available: false, error: 'Agency CallRail key not configured' })
  }

  const headers = { Authorization: `Token token="${agencyKey}"` }

  try {
    const accountsRes = await fetch(`${CALLRAIL_API}/a.json?per_page=100`, { headers })
    if (!accountsRes.ok) {
      return NextResponse.json({ available: false, error: 'Agency CallRail key was rejected' })
    }
    const accountsJson = await accountsRes.json()
    const accounts: { id: string; name: string }[] = accountsJson.accounts || []
    if (accounts.length === 0) {
      return NextResponse.json({ available: false, error: 'No accounts found for agency key' })
    }

    const results = await Promise.all(
      accounts.map(async (account) => {
        const list: { id: string; name: string; accountId: string; accountName: string }[] = []
        for (let page = 1; page <= 4; page++) {
          const res = await fetch(
            `${CALLRAIL_API}/a/${account.id}/companies.json?status=active&per_page=250&page=${page}`,
            { headers }
          )
          if (!res.ok) break
          const json = await res.json()
          for (const c of json.companies || []) {
            list.push({ id: c.id, name: c.name, accountId: account.id, accountName: account.name })
          }
          if (!json.companies || json.companies.length < 250) break
        }
        return list
      })
    )

    const companies = results.flat().sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      available: true,
      accounts,
      companies,
    })
  } catch (err: any) {
    return NextResponse.json({ available: false, error: err.message })
  }
}
