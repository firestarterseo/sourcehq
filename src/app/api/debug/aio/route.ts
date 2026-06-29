import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/run-visibility'

export const maxDuration = 30

export async function GET(req: NextRequest) {
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
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = new URL(req.url)
  const clientId = url.searchParams.get('client_id') || 'bb0b88d0-0cbf-46af-805e-10ee1b9c2e47'

  const db = adminClient()

  // Mimic the exact GET route logic
  const { data: prompts } = await db
    .from('ai_visibility_prompts')
    .select('id, prompt_text, intent_tag, active')
    .eq('client_id', clientId)

  const { data: runs } = await db
    .from('ai_visibility_runs')
    .select('id, prompt_id, engine, run_at, score, citations')
    .eq('client_id', clientId)
    .order('run_at', { ascending: true })

  const promptText = new Map<string, string>((prompts || []).map((p: any) => [p.id, p.prompt_text]))

  const runIds = (runs || []).map((r: any) => r.id)
  const mentionsByRun = new Map<string, any>()
  let mentionsErr: any = null
  if (runIds.length) {
    const result = await db
      .from('ai_visibility_mentions')
      .select('run_id, brand_mentioned, brand_cited, answer_position, total_named, competitors, sentiment')
      .in('run_id', runIds)
    mentionsErr = result.error?.message || null
    for (const m of result.data || []) mentionsByRun.set(m.run_id, m)
  }

  const latestByPair = new Map<string, any>()
  for (const run of runs || []) {
    if (!promptText.has(run.prompt_id)) continue
    latestByPair.set(`${run.engine}|${run.prompt_id}`, run)
  }

  // For one specific pair, walk through the logic and dump every step
  const sampleRuns = Array.from(latestByPair.values()).slice(0, 8)
  const sampleResults = sampleRuns.map((run: any) => {
    const m = mentionsByRun.get(run.id)
    return {
      run_id: run.id,
      engine: run.engine,
      prompt: promptText.get(run.prompt_id),
      score: run.score,
      mentions_map_has_key: mentionsByRun.has(run.id),
      mention_object: m || null,
      computed_mentioned: !!(m && m.brand_mentioned),
      computed_cited: !!(m && m.brand_cited),
      computed_position: m ? Number(m.answer_position) || 0 : 0,
    }
  })

  return NextResponse.json({
    total_prompts: (prompts || []).length,
    total_runs: (runs || []).length,
    total_run_ids: runIds.length,
    total_mentions_fetched: mentionsByRun.size,
    mentions_query_error: mentionsErr,
    latest_pair_count: latestByPair.size,
    sample_results: sampleResults,
  })
}
