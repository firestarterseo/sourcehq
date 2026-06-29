import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/run-visibility'

export const maxDuration = 30

function weekKey(iso: string): string {
  const d = new Date(iso)
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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
  const weeks = Math.max(1, Math.min(520, Number(url.searchParams.get('weeks') || '8')))

  const cutoffMs = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000
  const cutoff = new Date(cutoffMs).toISOString()

  const db = adminClient()
  const { data: runs, error } = await db
    .from('ai_visibility_runs')
    .select('id, run_at')
    .eq('client_id', id)
    .gte('run_at', cutoff)
    .order('run_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const runIds = (runs || []).map((r: any) => r.id)
  const runWeekById = new Map<string, string>((runs || []).map((r: any) => [r.id, weekKey(r.run_at)]))

  // Pull mentions in batches.
  const mentionByRun = new Map<string, { mentioned: boolean; cited: boolean }>()
  if (runIds.length) {
    const BATCH = 100
    for (let i = 0; i < runIds.length; i += BATCH) {
      const slice = runIds.slice(i, i + BATCH)
      const { data: m } = await db
        .from('ai_visibility_mentions')
        .select('run_id, brand_mentioned, brand_cited')
        .in('run_id', slice)
      for (const row of m || []) {
        mentionByRun.set(row.run_id, { mentioned: !!row.brand_mentioned, cited: !!row.brand_cited })
      }
    }
  }

  // Bucket per week: count cited, mentioned-not-cited, absent.
  const buckets = new Map<string, { cited: number; mentioned: number; absent: number; total: number }>()
  for (const r of runs || []) {
    const wk = runWeekById.get(r.id)!
    if (!buckets.has(wk)) buckets.set(wk, { cited: 0, mentioned: 0, absent: 0, total: 0 })
    const b = buckets.get(wk)!
    const m = mentionByRun.get(r.id)
    if (m?.cited) b.cited += 1
    else if (m?.mentioned) b.mentioned += 1
    else b.absent += 1
    b.total += 1
  }

  const weekLabels = Array.from(buckets.keys()).sort()
  const points = weekLabels.map(wk => {
    const b = buckets.get(wk)!
    return { week: wk, cited: b.cited, mentioned: b.mentioned, absent: b.absent, total: b.total }
  })

  return NextResponse.json({
    weeks_requested: weeks,
    week_labels: weekLabels,
    points,
    total_runs: (runs || []).length,
  })
}
