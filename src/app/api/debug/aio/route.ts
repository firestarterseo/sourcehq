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

  // Use admin client (service role, bypasses RLS) to see the "true" state of the data
  const adminDb = adminClient()

  // Pull the most recent 6 runs admin-side
  const { data: adminRuns, error: runsErr } = await adminDb
    .from('ai_visibility_runs')
    .select('id, engine, prompt_id, score')
    .eq('client_id', clientId)
    .order('run_at', { ascending: false })
    .limit(6)

  const runIds = (adminRuns || []).map((r: any) => r.id)

  // Try fetching mentions both ways: admin (service role) and as the logged-in user
  const { data: adminMentions, error: adminMentionsErr } = await adminDb
    .from('ai_visibility_mentions')
    .select('run_id, brand_mentioned, brand_cited, answer_position')
    .in('run_id', runIds.length ? runIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: userMentions, error: userMentionsErr } = await supabase
    .from('ai_visibility_mentions')
    .select('run_id, brand_mentioned, brand_cited, answer_position')
    .in('run_id', runIds.length ? runIds : ['00000000-0000-0000-0000-000000000000'])

  return NextResponse.json({
    client_id: clientId,
    run_ids: runIds,
    runs_sample: adminRuns,
    admin_mentions_count: (adminMentions || []).length,
    admin_mentions_error: adminMentionsErr?.message || null,
    admin_mentions_sample: adminMentions,
    user_mentions_count: (userMentions || []).length,
    user_mentions_error: userMentionsErr?.message || null,
    user_mentions_sample: userMentions,
  })
}
