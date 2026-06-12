import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

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

async function fetchInternal(path: string, cookieHeader: string) {
  try {
    const res = await fetch(`https://sourcehq.vercel.app${path}`, {
      headers: { cookie: cookieHeader },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// GET: list reports for this client
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: reports } = await adminClient()
    .from('reports')
    .select('id, title, period, created_at')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ reports: reports || [] })
}

// POST: generate a new SOURCE report for this client
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const cookieHeader = request.headers.get('cookie') || ''

  const { data: client } = await adminClient()
    .from('clients')
    .select('name, industry, website')
    .eq('id', id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const [gsc, ga4, callrail] = await Promise.all([
    fetchInternal(`/api/clients/${id}/gsc`, cookieHeader),
    fetchInternal(`/api/clients/${id}/ga4`, cookieHeader),
    fetchInternal(`/api/clients/${id}/callrail`, cookieHeader),
  ])

  const hasData = gsc?.summary || ga4?.summary || callrail?.summary
  if (!hasData) {
    return NextResponse.json({ error: 'No connected data sources with data for this client yet' }, { status: 400 })
  }

  const prompt = `You are the analysis engine for SOURCE HQ, an SEO agency intelligence platform built around the "SOURCED not Cited" methodology: insights must come directly from the client's own first-party data.

Client: ${client.name}
Industry: ${client.industry || 'Unknown'}
Website: ${client.website || 'Unknown'}
Reporting period: Last 28 days

DATA:
Search Console: ${JSON.stringify(gsc?.summary ? { summary: gsc.summary, topQueries: gsc.topQueries?.slice(0, 10), topPages: gsc.topPages?.slice(0, 10), daily: gsc.daily } : 'not connected')}
Google Analytics: ${JSON.stringify(ga4?.summary ? { summary: ga4.summary, topPages: ga4.topPages?.slice(0, 10), channels: ga4.channels, daily: ga4.daily } : 'not connected')}
CallRail: ${JSON.stringify(callrail?.summary ? { summary: callrail.summary, sources: callrail.sources, daily: callrail.daily } : 'not connected')}

Write a marketing intelligence report for this client. Rules:
- Every claim must reference specific numbers from the data above
- Write for a business owner, not an SEO. Plain language, no jargon without explanation
- Be honest: small numbers are small. Do not inflate. If data volume is low, say so and frame what it means
- Cross-reference sources where possible (e.g. search clicks vs sessions vs calls)
- Be specific in recommendations: name the actual pages, queries, and channels from the data

Respond with ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "title": "string - report title including client name and period",
  "executive_summary": "string - 3-5 sentence overview a busy owner reads in 30 seconds",
  "wins": ["string - 2-4 specific positives with numbers"],
  "concerns": ["string - 1-3 honest concerns with numbers"],
  "opportunities": ["string - 2-4 specific opportunities grounded in the data"],
  "actions": ["string - 3-5 concrete recommended next steps, most impactful first"]
}`

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    return NextResponse.json({ error: `AI request failed: ${errText.slice(0, 200)}` }, { status: 500 })
  }

  const aiJson = await aiRes.json()
  const text = (aiJson.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')

  let content: any
  try {
    content = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return NextResponse.json({ error: 'AI returned unparseable content, try again' }, { status: 500 })
  }

  const { data: report, error } = await adminClient()
    .from('reports')
    .insert({
      client_id: id,
      title: content.title || `${client.name} — SOURCE Report`,
      content,
      period: 'Last 28 days',
    })
    .select('id, title, period, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ report })
}
