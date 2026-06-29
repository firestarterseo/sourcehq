import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 90

function dataForSeoAuth() {
  if (process.env.DATAFORSEO_B64) return `Basic ${process.env.DATAFORSEO_B64}`
  const login = process.env.DATAFORSEO_LOGIN ?? ''
  const password = process.env.DATAFORSEO_PASSWORD ?? ''
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

function parseAIOResult(result: any): { answer: string; citations: string[] } {
  const items = result?.items ?? []
  const aio = Array.isArray(items) ? items.find((it: any) => it?.type === 'ai_overview') : null
  if (!aio) return { answer: '', citations: [] }

  let answer = typeof aio.markdown === 'string' ? aio.markdown : ''
  if (!answer && Array.isArray(aio.items)) {
    answer = aio.items
      .filter((el: any) => el?.type === 'ai_overview_element')
      .map((el: any) => el.markdown || el.text || '')
      .filter(Boolean)
      .join('\n\n')
  }

  const refs: string[] = []
  const collect = (arr: any) => {
    if (Array.isArray(arr)) {
      for (const r of arr) {
        if (r?.url) refs.push(String(r.url))
      }
    }
  }
  collect(aio.references)
  if (Array.isArray(aio.items)) {
    for (const el of aio.items) collect(el?.references)
  }
  return { answer, citations: Array.from(new Set(refs)) }
}

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

  const locationCode = Number(url.searchParams.get('location_code') || '2840')
  const languageCode = url.searchParams.get('language_code') || 'en'

  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
    method: 'POST',
    headers: { Authorization: dataForSeoAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      keyword,
      location_code: locationCode,
      language_code: languageCode,
      load_async_ai_overview: true,
      expand_ai_overview: true,
    }]),
  })
  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: `DataForSEO ${res.status}`, body: body.slice(0, 2000) }, { status: 500 })
  }
  const data = await res.json()
  const result = data?.tasks?.[0]?.result?.[0]
  const items = Array.isArray(result?.items) ? result.items : []
  const itemTypes = items.map((it: any) => it?.type)
  const aioItem = items.find((it: any) => it?.type === 'ai_overview') || null
  const parsed = parseAIOResult(result)

  return NextResponse.json({
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    status_code: data?.status_code,
    status_message: data?.status_message,
    cost: data?.cost,
    item_types_seen: itemTypes,
    has_ai_overview_item: !!aioItem,
    ai_overview_keys: aioItem ? Object.keys(aioItem) : [],
    parsed_answer_length: parsed.answer.length,
    parsed_citation_count: parsed.citations.length,
    parsed_citations: parsed.citations,
    ai_overview_raw: aioItem,
  })
}


