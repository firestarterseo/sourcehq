import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/run-visibility'

export const maxDuration = 30

function weekKey(iso: string): string {
  const d = new Date(iso)
  // ISO week start = Monday. Compute the Monday of that week in UTC.
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
    .select('id, engine, run_at, score')
    .eq('client_id', id)
    .gte('run_at', cutoff)
    .order('run_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group: engine -> week -> { sum, count }
  const buckets = new Map<string, Map<string, { sum: number; count: number }>>()
  const allWeeks = new Set<string>()
  for (const r of runs || []) {
    const wk = weekKey(r.run_at)
    allWeeks.add(wk)
    if (!buckets.has(r.engine)) buckets.set(r.engine, new Map())
    const eng = buckets.get(r.engine)!
    const prev = eng.get(wk) || { sum: 0, count: 0 }
    eng.set(wk, { sum: prev.sum + (Number(r.score) || 0), count: prev.count + 1 })
  }

  const sortedWeeks = Array.from(allWeeks).sort()
  const series: { engine: string; points: { week: string; score: number | null }[] }[] = []
  for (const [engine, weekMap] of Array.from(buckets.entries())) {
    const points = sortedWeeks.map(wk => {
      const b = weekMap.get(wk)
      return { week: wk, score: b && b.count ? Math.round(b.sum / b.count) : null }
    })
    series.push({ engine, points })
  }

  return NextResponse.json({
    weeks_requested: weeks,
    week_labels: sortedWeeks,
    series,
    total_runs: (runs || []).length,
  })
}
