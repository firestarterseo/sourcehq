import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { adminClient, dataForSeoConfigured, tagCitations, runClientVisibility } from '@/lib/run-visibility'

export const maxDuration = 300

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

// --- GET: return the latest stored result per prompt+engine, ready to render ---
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = adminClient()

  const { data: client } = await db.from('clients').select('name, website').eq('id', id).single()
  const domain = client?.website ? String(client.website).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase() : ''

  const { data: prompts } = await db
    .from('ai_visibility_prompts')
    .select('id, prompt_text, intent_tag, active')
    .eq('client_id', id)

  const { data: runs } = await db
    .from('ai_visibility_runs')
    .select('id, prompt_id, engine, run_at, score, citations')
    .eq('client_id', id)
    .order('run_at', { ascending: true })

  const promptText = new Map<string, string>((prompts || []).map((p: any) => [p.id, p.prompt_text]))

  const runIds = (runs || []).map((r: any) => r.id)
  const mentionsByRun = new Map<string, any>()
  if (runIds.length) {
    const { data: mentions } = await db
      .from('ai_visibility_mentions')
      .select('run_id, brand_mentioned, brand_cited, answer_position, total_named, competitors, sentiment')
      .in('run_id', runIds)
    for (const m of mentions || []) mentionsByRun.set(m.run_id, m)
  }

  const latestByPair = new Map<string, any>()
  let lastRunAt: string | null = null
  for (const run of runs || []) {
    if (!promptText.has(run.prompt_id)) continue
    latestByPair.set(`${run.engine}|${run.prompt_id}`, run)
    if (!lastRunAt || run.run_at > lastRunAt) lastRunAt = run.run_at
  }

  const results: any[] = []
  for (const run of Array.from(latestByPair.values())) {
    const m = mentionsByRun.get(run.id)
    const mentioned = !!(m && m.brand_mentioned)
    const cited = !!(m && m.brand_cited)
    const competitors = (m && Array.isArray(m.competitors)) ? m.competitors : []
    results.push({
      engine: run.engine,
      prompt: promptText.get(run.prompt_id),
      mentioned,
      cited,
      position: m ? Number(m.answer_position) || 0 : 0,
      score: Number(run.score) || 0,
      sentiment: m ? (m.sentiment || 'n/a') : 'n/a',
      citations: tagCitations(run.citations || [], domain, competitors),
    })
  }

  const overall = results.length ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length) : 0

  const byEngine: Record<string, { overall: number; count: number }> = {}
  const engineKeys = Array.from(new Set(results.map((r) => r.engine)))
  for (const key of engineKeys) {
    const rows = results.filter((r) => r.engine === key)
    byEngine[key] = {
      overall: rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0,
      count: rows.length,
    }
  }

  return NextResponse.json({
    prompts: prompts || [],
    runs: runs || [],
    results,
    engines: byEngine,
    overall: results.length ? overall : null,
    lastRunAt,
    aioConfigured: dataForSeoConfigured(),
  })
}

// --- POST: run a visibility check now (thin wrapper over the shared run function) ---
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = adminClient()
  const outcome = await runClientVisibility(db, id)
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.error === 'Client not found' ? 404 : 400 })
  }
  return NextResponse.json({
    overall: outcome.overall,
    engines: outcome.engines,
    count: outcome.count,
    aioError: outcome.aioError,
    results: outcome.results,
  })
}
