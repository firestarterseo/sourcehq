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
  const { data: runs } = await db
    .from('ai_visibility_runs')
    .select('id, engine, prompt_id, score, citations, run_at')
    .eq('client_id', clientId)
    .order('run_at', { ascending: false })
    .limit(60)

  const { data: prompts } = await db
    .from('ai_visibility_prompts')
    .select('id, prompt_text')
    .eq('client_id', clientId)
  const promptMap = new Map((prompts || []).map((p: any) => [p.id, p.prompt_text]))

  const runIds = (runs || []).map((r: any) => r.id)
  const { data: mentions } = await db
    .from('ai_visibility_mentions')
    .select('run_id, brand_mentioned, brand_cited, answer_position, total_named, sentiment')
    .in('run_id', runIds.length ? runIds : ['00000000-0000-0000-0000-000000000000'])
  const mentionMap = new Map((mentions || []).map((m: any) => [m.run_id, m]))

  const rows = (runs || []).map((r: any) => {
    const m = mentionMap.get(r.id)
    return {
      run_at: r.run_at,
      engine: r.engine,
      prompt: promptMap.get(r.prompt_id) || '(unknown)',
      score: r.score,
      citations_count: Array.isArray(r.citations) ? r.citations.length : 0,
      mentioned: m ? !!m.brand_mentioned : null,
      cited: m ? !!m.brand_cited : null,
      position: m ? m.answer_position : null,
    }
  })

  const engineCounts: Record<string, number> = {}
  for (const r of rows) engineCounts[r.engine] = (engineCounts[r.engine] || 0) + 1

  return NextResponse.json({
    client_id: clientId,
    total_recent_runs: rows.length,
    engine_counts_in_recent_runs: engineCounts,
    rows,
  })
}
