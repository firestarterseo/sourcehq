import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 120

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
  const keyword = url.searchParams.get('keyword') || ''
  if (!keyword) return NextResponse.json({ error: 'Missing keyword param' }, { status: 400 })

  const country = url.searchParams.get('country') || 'US'
  const apiKey = process.env.CLORO_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'CLORO_API_KEY not configured' }, { status: 500 })

  const started = Date.now()
  const res = await fetch('https://api.cloro.dev/v1/monitor/google', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: keyword,
      country,
      include: { aioverview: { markdown: true } },
    }),
  })
  const elapsed_ms = Date.now() - started

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: `cloro ${res.status}`, body: body.slice(0, 2000), elapsed_ms }, { status: 500 })
  }
  const data = await res.json()
  const aio = data?.result?.aioverview ?? null
  const sources = Array.isArray(aio?.sources) ? aio.sources : []

  return NextResponse.json({
    keyword,
    country,
    elapsed_ms,
    success: data?.success === true,
    has_aioverview: !!aio,
    aioverview_text_length: typeof aio?.text === 'string' ? aio.text.length : 0,
    aioverview_markdown_length: typeof aio?.markdown === 'string' ? aio.markdown.length : 0,
    sources_count: sources.length,
    source_urls: sources.map((s: any) => s?.url).filter(Boolean),
    aioverview_raw: aio,
  })
}
