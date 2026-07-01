import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { buildDerivativePrompt, type DerivativePlatform } from '@/lib/derivative-prompts'
import type { SourceReport } from '@/lib/report-types'

export const maxDuration = 120

const VALID_PLATFORMS: DerivativePlatform[] = ['linkedin', 'reddit', 'medium', 'pr_wire']

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

export async function GET(_: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: derivatives, error } = await adminClient()
    .from('report_derivatives')
    .select('id, platform, target, title, subtitle, body, meta, status, created_at, updated_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ derivatives: derivatives || [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  let platform: DerivativePlatform
  try {
    const body = await request.json()
    if (!VALID_PLATFORMS.includes(body.platform)) {
      return NextResponse.json({ error: 'platform must be one of: ' + VALID_PLATFORMS.join(', ') }, { status: 400 })
    }
    platform = body.platform
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const admin = adminClient()
  const { data: report, error: reportError } = await admin
    .from('reports')
    .select('id, client_id, content')
    .eq('id', reportId)
    .single()

  if (reportError || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const sourceReport = report.content as SourceReport
  if (!sourceReport || !sourceReport.title) {
    return NextResponse.json({ error: 'This report has no publishable content yet' }, { status: 400 })
  }

  const prompt = buildDerivativePrompt(platform, sourceReport)

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    return NextResponse.json({ error: 'AI request failed: ' + errText.slice(0, 200) }, { status: 500 })
  }

  const aiJson = await aiRes.json()
  const text = (aiJson.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')

  let parsed: any
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return NextResponse.json({ error: 'AI returned unparseable content, try again' }, { status: 500 })
  }

  const meta: Record<string, any> = {}
  if (platform === 'reddit') {
    meta.topComment = parsed.topComment || ''
    meta.subredditSuggestions = parsed.subredditSuggestions || []
  }
  if (platform === 'medium') {
    meta.tags = parsed.tags || []
  }

  const { data: derivative, error: insertError } = await admin
    .from('report_derivatives')
    .insert({
      report_id: reportId,
      client_id: report.client_id,
      platform,
      title: parsed.title || '',
      subtitle: parsed.subtitle || null,
      body: parsed.body || '',
      meta,
      status: 'draft',
    })
    .select('id, platform, target, title, subtitle, body, meta, status, created_at, updated_at')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
  return NextResponse.json({ derivative })
}
