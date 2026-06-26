import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/run-visibility'

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

  const db = adminClient()
  const url = new URL(req.url)
  const batchId = url.searchParams.get('batchId')

  let q = db.from('ai_visibility_batches')
    .select('id, status, total_jobs, completed_jobs, error_jobs, created_at, finished_at')
    .eq('client_id', id)

  if (batchId) {
    q = q.eq('id', batchId)
  } else {
    q = q.order('created_at', { ascending: false }).limit(1)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const batch = Array.isArray(data) ? data[0] : data
  if (!batch) return NextResponse.json({ batch: null })

  const done = (batch.completed_jobs || 0) + (batch.error_jobs || 0)
  return NextResponse.json({
    batch: {
      id: batch.id,
      status: batch.status,
      total: batch.total_jobs || 0,
      done,
      completed: batch.completed_jobs || 0,
      errored: batch.error_jobs || 0,
      finishedAt: batch.finished_at,
    },
  })
}