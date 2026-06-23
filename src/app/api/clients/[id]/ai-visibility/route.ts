import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const maxDuration = 300

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_MODEL = 'sonar-pro'
const DATAFORSEO_POST = 'https://api.dataforseo.com/v3/serp/google/organic/task_post'
const DATAFORSEO_GET = 'https://api.dataforseo.com/v3/serp/google/organic/task_get/advanced'

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function dataForSeoAuth() {
  if (process.env.DATAFORSEO_B64) return `Basic ${process.env.DATAFORSEO_B64}`
  const login = process.env.DATAFORSEO_LOGIN ?? ''
  const password = process.env.DATAFORSEO_PASSWORD ?? ''
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

function dataForSeoConfigured() {
  return !!(process.env.DATAFORSEO_B64 || (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD))
}

function hostOf(url: string) {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase() }
  catch { return String(url).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase() }
}

function tagCitations(citations: string[], domain: string, competitors: string[]): { url: string; tag: 'own' | 'competitor' | null }[] {
  const compHosts = competitors.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
  return (citations || []).map((url) => {
    const host = hostOf(url)
    let tag: 'own' | 'competitor' | null = null
    if (domain && host.includes(domain)) tag = 'own'
    else if (compHosts.some((c) => host.includes(c.replace(/\s+/g, '')) || c.includes(host.split('.')[0]))) tag = 'competitor'
    return { url, tag }
  })
}

// --- Perplexity: one prompt, returns answer + citations ---
async function queryPerplexity(prompt: string) {
  const res = await fetch(PERPLEXITY_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Perplexity ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const answer = data?.choices?.[0]?.message?.content ?? ''
  let citations: string[] = []
  if (Array.isArray(data?.citations)) citations = data.citations
  else if (Array.isArray(data?.search_results)) citations = data.search_results.map((s: any) => s.url || s.link).filter(Boolean)
  return { answer, citations }
}

// --- Extract the AI Overview answer + cited URLs from one task_get result ---
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

// Post one batch of keywords, poll their tasks, return Map of promptId -> parsed FOR HITS ONLY.
// A completed-but-empty task is dropped from pending (re-reading it never changes), so empties
// fall through and are handled by the caller's retry sweep with fresh tasks.
async function runAioBatch(batch: { id: string; prompt_text: string }[], auth: string, maxRounds: number): Promise<Map<string, { answer: string; citations: string[] }>> {
  const hits = new Map<string, { answer: string; citations: string[] }>()
  const kwToPrompt = new Map(batch.map((p) => [p.prompt_text, p]))

  const postBody = batch.map((p) => ({
    keyword: p.prompt_text,
    location_code: 2840,
    language_code: 'en',
    load_async_ai_overview: true,
    expand_ai_overview: true,
    tag: 'sourcehq_aio',
  }))
  const postRes = await fetch(DATAFORSEO_POST, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(postBody),
  })
  if (!postRes.ok) {
    const body = await postRes.text()
    throw new Error(`DataForSEO task_post ${postRes.status}: ${body.slice(0, 200)}`)
  }
  const postData = await postRes.json()
  if (postData?.status_code !== 20000) {
    throw new Error(`DataForSEO task_post status ${postData?.status_code}: ${postData?.status_message}`)
  }

  const idToPrompt = new Map<string, { id: string; prompt_text: string }>()
  for (const t of postData?.tasks ?? []) {
    const kw = t?.data?.keyword
    const prompt = kw ? kwToPrompt.get(kw) : null
    if (t?.id && prompt) idToPrompt.set(t.id, prompt)
  }
  if (idToPrompt.size === 0) {
    throw new Error('DataForSEO task_post returned no usable task ids')
  }

  const pending = new Set(idToPrompt.keys())
  for (let round = 0; round < maxRounds && pending.size > 0; round++) {
    await sleep(3000)
    for (const id of Array.from(pending)) {
      try {
        const getRes = await fetch(`${DATAFORSEO_GET}/${id}`, { method: 'GET', headers: { Authorization: auth } })
        if (!getRes.ok) continue
        const getData = await getRes.json()
        const task = getData?.tasks?.[0]
        if (task?.status_code === 20000 && Array.isArray(task?.result) && task.result.length) {
          const parsed = parseAIOResult(task.result[0])
          const prompt = idToPrompt.get(id)!
          if (parsed.answer || parsed.citations.length) {
            hits.set(prompt.id, parsed)
          }
          pending.delete(id)
        }
      } catch {
        // transient, retry next round
      }
    }
  }
  return hits
}

// --- AI Overviews: batch fetch with one retry sweep for prompts that came back empty ---
async function fetchAIOverviews(prompts: { id: string; prompt_text: string }[]): Promise<Map<string, { answer: string; citations: string[] }>> {
  const auth = dataForSeoAuth()

  const hits = await runAioBatch(prompts, auth, 25)

  const empties = prompts.filter((p) => !hits.has(p.id))
  if (empties.length > 0) {
    await sleep(5000)
    try {
      const retry = await runAioBatch(empties, auth, 20)
      for (const [k, v] of retry) hits.set(k, v)
    } catch {
      // retry is best-effort; keep first-pass hits
    }
  }

  const out = new Map<string, { answer: string; citations: string[] }>()
  for (const p of prompts) out.set(p.id, hits.get(p.id) ?? { answer: '', citations: [] })
  return out
}

// --- Parse an answer with Claude (language extraction only) ---
async function parseAnswer(brand: string, prompt: string, answer: string) {
  const parsePrompt = `You are analyzing an AI search engine's answer to measure brand visibility.

TARGET BRAND: "${brand}"
USER PROMPT WAS: "${prompt}"

AI ENGINE ANSWER:
"""
${answer}
"""

Return ONLY a JSON object (no markdown, no preamble) with exactly these keys:
{
  "brand_mentioned": boolean,
  "answer_position": number,
  "total_named": number,
  "competitors": ["string"],
  "sentiment": "positive" | "neutral" | "negative" | "n/a"
}

Rules: brand_mentioned is true only if the TARGET BRAND is clearly named. answer_position is its order among all businesses named (1 = first), 0 if not mentioned. total_named is how many distinct businesses are named. competitors excludes the target brand. Be strict.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: parsePrompt }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  const text = (json.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    return { brand_mentioned: false, answer_position: 0, total_named: 0, competitors: [], sentiment: 'n/a' }
  }
}

// --- Deterministic score (code, never the LLM) ---
function scoreResult(parsed: any, cited: boolean) {
  let score = 0
  if (cited) score += 50
  if (parsed.brand_mentioned) score += 30
  if (parsed.brand_mentioned && parsed.answer_position > 0) {
    score += Math.max(2, 20 - (parsed.answer_position - 1) * 4)
  }
  return Math.min(100, score)
}

// --- Parse, score, and write one run + mentions row ---
async function recordRun(
  db: any, clientId: string, promptId: string, promptText: string, engineKey: string,
  brand: string, domain: string, answer: string, citations: string[], results: any[]
) {
  try {
    const cited = domain ? citations.some((u) => String(u).toLowerCase().includes(domain)) : false
    const parsed = answer
      ? await parseAnswer(brand, promptText, answer)
      : { brand_mentioned: false, answer_position: 0, total_named: 0, competitors: [], sentiment: 'n/a' }
    const score = scoreResult(parsed, cited)

    const { data: run } = await db
      .from('ai_visibility_runs')
      .insert({ client_id: clientId, prompt_id: promptId, engine: engineKey, raw_answer: answer, citations, score })
      .select('id')
      .single()

    if (run) {
      await db.from('ai_visibility_mentions').insert({
        run_id: run.id,
        brand_mentioned: !!parsed.brand_mentioned,
        brand_cited: cited,
        answer_position: Number(parsed.answer_position) || 0,
        total_named: Number(parsed.total_named) || 0,
        competitors: parsed.competitors || [],
        sentiment: parsed.sentiment || 'n/a',
      })
    }

    results.push({
      engine: engineKey,
      prompt: promptText,
      mentioned: !!parsed.brand_mentioned,
      cited,
      position: parsed.answer_position,
      score,
      sentiment: parsed.sentiment || 'n/a',
      citations: tagCitations(citations, domain, parsed.competitors || []),
    })
  } catch (err: any) {
    results.push({ engine: engineKey, prompt: promptText, error: err.message })
  }
}

// --- GET: return run history (trend series) ---
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = adminClient()
  const { data: runs } = await db
    .from('ai_visibility_runs')
    .select('id, prompt_id, engine, run_at, score, citations')
    .eq('client_id', id)
    .order('run_at', { ascending: true })

  const { data: prompts } = await db
    .from('ai_visibility_prompts')
    .select('id, prompt_text, intent_tag, active')
    .eq('client_id', id)

  return NextResponse.json({ runs: runs || [], prompts: prompts || [], aioConfigured: dataForSeoConfigured() })
}

// --- POST: execute a visibility run across all active prompts and engines ---
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!process.env.PERPLEXITY_API_KEY) return NextResponse.json({ error: 'PERPLEXITY_API_KEY not configured' }, { status: 500 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const db = adminClient()

  const { data: client } = await db.from('clients').select('name, website').eq('id', id).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const brand = String(client.name).trim()
  const domain = client.website ? String(client.website).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase() : ''

  const { data: prompts } = await db
    .from('ai_visibility_prompts')
    .select('id, prompt_text')
    .eq('client_id', id)
    .eq('active', true)

  if (!prompts || prompts.length === 0) {
    return NextResponse.json({ error: 'No active prompts for this client.' }, { status: 400 })
  }

  const results: any[] = []
  let aioError: string | null = null

  let aioByPrompt: Map<string, { answer: string; citations: string[] }> | null = null
  if (dataForSeoConfigured()) {
    try {
      aioByPrompt = await fetchAIOverviews(prompts)
    } catch (err: any) {
      aioError = err.message
      aioByPrompt = null
    }
  }

  for (const p of prompts) {
    try {
      const { answer, citations } = await queryPerplexity(p.prompt_text)
      await recordRun(db, id, p.id, p.prompt_text, `perplexity:${PERPLEXITY_MODEL}`, brand, domain, answer, citations, results)
    } catch (err: any) {
      results.push({ engine: `perplexity:${PERPLEXITY_MODEL}`, prompt: p.prompt_text, error: err.message })
    }
    await sleep(1200)

    if (aioByPrompt) {
      const aio = aioByPrompt.get(p.id) ?? { answer: '', citations: [] }
      await recordRun(db, id, p.id, p.prompt_text, 'google_ai_overviews:dataforseo', brand, domain, aio.answer, aio.citations, results)
    }
  }

  const scored = results.filter((r) => !r.error)
  const overall = scored.length ? Math.round(scored.reduce((a, r) => a + r.score, 0) / scored.length) : 0

  const byEngine: Record<string, { overall: number; count: number }> = {}
  const engineKeys = Array.from(new Set(results.map((r) => r.engine)))
  for (const key of engineKeys) {
    const rows = scored.filter((r) => r.engine === key)
    byEngine[key] = {
      overall: rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0,
      count: rows.length,
    }
  }

  return NextResponse.json({ overall, engines: byEngine, count: results.length, aioError, results })
}
