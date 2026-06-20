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

// Add one or more prompts (manual entry or accepted suggestions)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let prompts: string[] = []
  let intentTag = 'manual'
  try {
    const body = await request.json()
    if (typeof body?.prompt === 'string') prompts = [body.prompt]
    if (Array.isArray(body?.prompts)) prompts = body.prompts.filter((p: any) => typeof p === 'string')
    if (typeof body?.intent_tag === 'string') intentTag = body.intent_tag
  } catch {}

  prompts = prompts.map(p => p.trim()).filter(Boolean)
  if (prompts.length === 0) return NextResponse.json({ error: 'No prompt text provided' }, { status: 400 })

  const rows = prompts.map(p => ({ client_id: id, prompt_text: p, intent_tag: intentTag, active: true }))
  const { data, error } = await adminClient()
    .from('ai_visibility_prompts')
    .insert(rows)
    .select('id, prompt_text, intent_tag, active')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ added: data })
}

// Deactivate (soft-delete) a prompt by id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let promptId = ''
  try {
    const body = await request.json()
    if (typeof body?.prompt_id === 'string') promptId = body.prompt_id
  } catch {}
  if (!promptId) return NextResponse.json({ error: 'No prompt_id provided' }, { status: 400 })

  const { error } = await adminClient()
    .from('ai_visibility_prompts')
    .update({ active: false })
    .eq('id', promptId)
    .eq('client_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
