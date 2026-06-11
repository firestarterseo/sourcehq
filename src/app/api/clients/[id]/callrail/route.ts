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

// POST: save + verify a CallRail API key for this client
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { api_key } = await request.json()
  if (!api_key) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

  // Verify the key by listing accounts
  const res = await fetch(`${CALLRAIL_API}/a.json`, { headers: authHeaders(api_key) })
  if (!res.ok) {
    return NextResponse.json({ error: 'CallRail rejected this API key — double-check it and try again' }, { status: 400 })
  }
  const json = await res.json()
  const account = json.accounts?.[0]
  if (!account) {
    return NextResponse.json({ error: 'No CallRail accounts found for this API key' }, { status: 400 })
  }

  const { error } = await adminClient()
    .from('data_connections')
    .upsert(
      {
        client_id: id,
        source_type: 'callrail',
        status: 'connected',
        credentials: { api_key, account_id: account.id, account_name: account.name },
      },
      { onConflict: 'client_id,source_type' }
    )

  if (error) {
    // Fallback if there's no unique constraint for upsert
    await adminClient().from('data_connections').delete().eq('client_id', id).eq('source_type', 'callrail')
    const { error: err2 } = await adminClient().from('data_connections').insert({
      client_id: id,
      source_type: 'callrail',
      status: 'connected',
      credentials: { api_key, account_id: account.id, account_name: account.name },
    })
    if (err2) return NextResponse.json({ error: err2.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, accountName: account.name })
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

  const { api_key, account_id, account_name } = connection.credentials

  try {
    const end = new Date()
    const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
    const startDate = start.toISOString().split('T')[0]
    const endDate = end.toISOString().split('T')[0]

    // Pull calls (up to 3 pages of 250 = 750 calls per 28 days)
    const calls: any[] = []
    for (let page = 1; page <= 3; page++) {
      const res = await fetch(
        `${CALLRAIL_API}/a/${account_id}/calls.json?start_date=${startDate}&end_date=${endDate}&per_page=250&page=${page}&fields=source,duration,first_call,answered,start_time`,
        { headers: authHeaders(api_key) }
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`CallRail error (${res.status}): ${body.slice(0, 200)}`)
      }
      const json = await res.json()
      calls.push(...(json.calls || []))
      if (!json.calls || json.calls.length < 250) break
    }

    // Aggregate
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

    // Fill in zero days so the chart has no gaps
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
      accountName: account_name,
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