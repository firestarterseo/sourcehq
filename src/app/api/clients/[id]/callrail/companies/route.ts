import { createClient } from '@supabase/supabase-js'
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

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function authHeaders(apiKey: string) {
  return { Authorization: `Token token="${apiKey}"` }
}

// POST: connect CallRail for this client.
// Mode A (agency): { company_id, company_name, account_id } — uses the agency key
// Mode B (standalone): { api_key } — client's own CallRail account
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  let credentials: any = null

  if (body.company_id) {
    if (!process.env.CALLRAIL_AGENCY_KEY) {
      return NextResponse.json({ error: 'Agency CallRail key not configured' }, { status: 400 })
    }
    credentials = {
      mode: 'agency',
      company_id: body.company_id,
      company_name: body.company_name || null,
      account_id: body.account_id || null,
    }
  } else if (body.api_key) {
    const res = await fetch(`${CALLRAIL_API}/a.json`, { headers: authHeaders(body.api_key) })
    if (!res.ok) {
      return NextResponse.json({ error: 'CallRail rejected this API key — double-check it and try again' }, { status: 400 })
    }
    const json = await res.json()
    const account = json.accounts?.[0]
    if (!account) {
      return NextResponse.json({ error: 'No CallRail accounts found for this API key' }, { status: 400 })
    }
    credentials = {
      mode: 'standalone',
      api_key: body.api_key,
      account_id: account.id,
      account_name: account.name,
    }
  } else {
    return NextResponse.json({ error: 'Provide either a company selection or an API key' }, { status: 400 })
  }

  await adminClient().from('data_connections').delete().eq('client_id', id).eq('source_type', 'callrail')
  const { error } = await adminClient().from('data_connections').insert({
    client_id: id,
    source_type: 'callrail',
    status: 'connected',
    credentials,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

// DELETE: disconnect CallRail for this client
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  await adminClient()
    .from('data_connections')
    .delete()
    .eq('client_id', id)
    .eq('source_type', 'callrail')

  return NextResponse.json({ success: true })
}

// GET: pull last-28-day call data
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: connection } = await adminClient()
    .from('data_connections')
    .select('credentials, status')
    .eq('client_id', id)
    .eq('source_type', 'callrail')
    .single()

  if (!connection || connection.status !== 'connected') {
    return NextResponse.json({ connected: false })
  }

  const creds = connection.credentials
  let apiKey: string
  let accountId: string
  let companyFilter = ''
  let label: string

  if (creds.mode === 'agency') {
    if (!process.env.CALLRAIL_AGENCY_KEY) {
      return NextResponse.json({ connected: true, error: 'Agency CallRail key not configured' })
    }
    apiKey = process.env.CALLRAIL_AGENCY_KEY
    if (creds.account_id) {
      accountId = creds.account_id
    } else {
      const accRes = await fetch(`${CALLRAIL_API}/a.json`, { headers: authHeaders(apiKey) })
      if (!accRes.ok) {
        return NextResponse.json({ connected: true, error: 'Agency CallRail key was rejected' })
      }
      const accJson = await accRes.json()
      accountId = accJson.accounts?.[0]?.id
    }
    companyFilter = `&company_id=${creds.company_id}`
    label = creds.company_name || 'CallRail'
  } else {
    apiKey = creds.api_key
    accountId = creds.account_id
    label = creds.account_name || 'CallRail'
  }

  try {
    const end = new Date()
    const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
    const startDate = start.toISOString().split('T')[0]
    const endDate = end.toISOString().split('T')[0]

    const calls: any[] = []
    for (let page = 1; page <= 3; page++) {
      const res = await fetch(
        `${CALLRAIL_API}/a/${accountId}/calls.json?start_date=${startDate}&end_date=${endDate}&per_page=250&page=${page}&fields=source,duration,first_call,answered,start_time${companyFilter}`,
        { headers: authHeaders(apiKey) }
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`CallRail error (${res.status}): ${body.slice(0, 200)}`)
      }
      const json = await res.json()
      calls.push(...(json.calls || []))
      if (!json.calls || json.calls.length < 250) break
    }

    const byDay: Record<string, number> = {}
    const bySource: Record<string, number> = {}
    let answered = 0
    let firstTime = 0
    let totalDuration = 0

    for (const c of calls) {
      const day = (c.start_time || '').split('T')[0]
      if (day) byDay[day] = (byDay[day] || 0) + 1
      const src = c.source || 'Unknown'
      bySource[src] = (bySource[src] || 0) + 1
      if (c.answered) answered++
      if (c.first_call) firstTime++
      totalDuration += c.duration || 0
    }

    const daily: { date: string; calls: number }[] = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0]
      daily.push({ date: key, calls: byDay[key] || 0 })
    }

    const sources = Object.entries(bySource)
      .map(([source, count]) => ({ source, calls: count }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 8)

    return NextResponse.json({
      connected: true,
      accountName: label,
      summary: {
        totalCalls: calls.length,
        answered,
        missed: calls.length - answered,
        firstTime,
        avgDurationSec: calls.length ? Math.round(totalDuration / calls.length) : 0,
        period: 'Last 28 days',
      },
      daily,
      sources,
    })
  } catch (err: any) {
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 })
  }
}