import { createClient } from '@supabase/supabase-js'
import { Client as QStashClient } from '@upstash/qstash'

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions'
export const PERPLEXITY_MODEL = 'sonar-pro'
const DATAFORSEO_LIVE = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'
const OPENAI_RESPONSES = 'https://api.openai.com/v1/responses'
export const OPENAI_MODEL = 'gpt-5.4-mini'
export const GEMINI_MODEL = 'gemini-3.5-flash'
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx])
    }
  }
  const n = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
}

export function dataForSeoAuth() {
  if (process.env.DATAFORSEO_B64) return `Basic ${process.env.DATAFORSEO_B64}`
  const login = process.env.DATAFORSEO_LOGIN ?? ''
  const password = process.env.DATAFORSEO_PASSWORD ?? ''
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

export function dataForSeoConfigured() {
  return !!(process.env.DATAFORSEO_B64 || (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD))
}

export function hostOf(url: string) {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase() }
  catch { return String(url).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase() }
}

export function tagCitations(citations: string[], domain: string, competitors: string[]): { url: string; tag: 'own' | 'competitor' | null }[] {
  const compHosts = competitors.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
  return (citations || []).map((url) => {
    const host = hostOf(url)
    let tag: 'own' | 'competitor' | null = null
    if (domain && host.includes(domain)) tag = 'own'
    else if (compHosts.some((c) => host.includes(c.replace(/\s+/g, '')) || c.includes(host.split('.')[0]))) tag = 'competitor'
    return { url, tag }
  })
}

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

async function queryChatGPT(prompt: string): Promise<{ answer: string; citations: string[] }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180000)
  try {
    const res = await fetch(OPENAI_RESPONSES, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        tools: [{ type: 'web_search' }],
        input: prompt,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    let answer = ''
    const refs: string[] = []
    const output = Array.isArray(data?.output) ? data.output : []
    for (const item of output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c?.text === 'string') answer += (answer ? '\n\n' : '') + c.text
          const anns = Array.isArray(c?.annotations) ? c.annotations : []
          for (const a of anns) {
            if (a?.type === 'url_citation' && a?.url) refs.push(String(a.url))
          }
        }
      }
    }
    if (!answer && typeof data?.output_text === 'string') answer = data.output_text
    return { answer, citations: Array.from(new Set(refs)) }
  } finally {
    clearTimeout(timeout)
  }
}

async function queryGemini(prompt: string): Promise<{ answer: string; citations: string[] }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)
  try {
    const res = await fetch(GEMINI_API, {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    const cand = data?.candidates?.[0]
    let answer = ''
    const parts = cand?.content?.parts
    if (Array.isArray(parts)) {
      answer = parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean).join('\n\n')
    }
    const refs: string[] = []
    const chunks = cand?.groundingMetadata?.groundingChunks
    if (Array.isArray(chunks)) {
      for (const ch of chunks) {
        const uri = ch?.web?.uri
        if (uri) refs.push(String(uri))
      }
    }
    return { answer, citations: Array.from(new Set(refs)) }
  } finally {
    clearTimeout(timeout)
  }
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

async function queryAIOverview(keyword: string): Promise<{ answer: string; citations: string[] }> {
  const auth = dataForSeoAuth()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000)
  try {
    const res = await fetch(DATAFORSEO_LIVE, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keyword,
        location_code: 2840,
        language_code: 'en',
        load_async_ai_overview: true,
        expand_ai_overview: true,
      }]),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`DataForSEO live ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    if (data?.status_code !== 20000) {
      throw new Error(`DataForSEO live status ${data?.status_code}: ${data?.status_message}`)
    }
    const result = data?.tasks?.[0]?.result?.[0]
    return parseAIOResult(result)
  } finally {
    clearTimeout(timeout)
  }
}

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

function scoreResult(parsed: any, cited: boolean) {
  let score = 0
  if (cited) score += 50
  if (parsed.brand_mentioned) score += 30
  if (parsed.brand_mentioned && parsed.answer_position > 0) {
    score += Math.max(2, 20 - (parsed.answer_position - 1) * 4)
  }
  return Math.min(100, score)
}

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

export type RunOutcome = {
  ok: boolean
  error?: string
  overall: number
  engines: Record<string, { overall: number; count: number }>
  count: number
  aioError: string | null
  results: any[]
}

export async function runClientVisibility(db: any, clientId: string): Promise<RunOutcome> {
  if (!process.env.PERPLEXITY_API_KEY) return { ok: false, error: 'PERPLEXITY_API_KEY not configured', overall: 0, engines: {}, count: 0, aioError: null, results: [] }
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY not configured', overall: 0, engines: {}, count: 0, aioError: null, results: [] }

  const { data: client } = await db.from('clients').select('name, website').eq('id', clientId).single()
  if (!client) return { ok: false, error: 'Client not found', overall: 0, engines: {}, count: 0, aioError: null, results: [] }
  const brand = String(client.name).trim()
  const domain = client.website ? String(client.website).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase() : ''

  const { data: prompts } = await db
    .from('ai_visibility_prompts')
    .select('id, prompt_text')
    .eq('client_id', clientId)
    .eq('active', true)

  if (!prompts || prompts.length === 0) {
    return { ok: false, error: 'No active prompts for this client.', overall: 0, engines: {}, count: 0, aioError: null, results: [] }
  }

  const results: any[] = []
  let aioError: string | null = null
  const aioOn = dataForSeoConfigured()

  const PROMPT_CONCURRENCY = 4

  async function processPrompt(p: { id: string; prompt_text: string }) {
    const jobs: Promise<void>[] = []

    jobs.push((async () => {
      try {
        const { answer, citations } = await queryPerplexity(p.prompt_text)
        await recordRun(db, clientId, p.id, p.prompt_text, `perplexity:${PERPLEXITY_MODEL}`, brand, domain, answer, citations, results)
      } catch (err: any) {
        results.push({ engine: `perplexity:${PERPLEXITY_MODEL}`, prompt: p.prompt_text, error: err.message })
      }
    })())

    if (process.env.OPENAI_API_KEY) {
      jobs.push((async () => {
        try {
          const { answer, citations } = await queryChatGPT(p.prompt_text)
          await recordRun(db, clientId, p.id, p.prompt_text, `chatgpt:${OPENAI_MODEL}`, brand, domain, answer, citations, results)
        } catch (err: any) {
          results.push({ engine: `chatgpt:${OPENAI_MODEL}`, prompt: p.prompt_text, error: err.message })
        }
      })())
    }

    if (process.env.GEMINI_API_KEY) {
      jobs.push((async () => {
        try {
          const { answer, citations } = await queryGemini(p.prompt_text)
          await recordRun(db, clientId, p.id, p.prompt_text, `gemini:${GEMINI_MODEL}`, brand, domain, answer, citations, results)
        } catch (err: any) {
          results.push({ engine: `gemini:${GEMINI_MODEL}`, prompt: p.prompt_text, error: err.message })
        }
      })())
    }

    if (aioOn) {
      jobs.push((async () => {
        try {
          const { answer, citations } = await queryAIOverview(p.prompt_text)
          await recordRun(db, clientId, p.id, p.prompt_text, 'google_ai_overviews:dataforseo', brand, domain, answer, citations, results)
        } catch (err: any) {
          if (!aioError) aioError = err.message
          results.push({ engine: 'google_ai_overviews:dataforseo', prompt: p.prompt_text, error: err.message })
        }
      })())
    }

    await Promise.allSettled(jobs)
  }

  await runWithConcurrency(prompts, PROMPT_CONCURRENCY, processPrompt)

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

  return { ok: true, overall, engines: byEngine, count: results.length, aioError, results }
}

// ============================================================
// Phase 1: process a single queued job (one prompt x one engine)
// ============================================================

async function queryOneEngine(engine: string, promptText: string): Promise<{ answer: string; citations: string[] }> {
  if (engine.startsWith('perplexity:')) return queryPerplexity(promptText)
  if (engine.startsWith('chatgpt:')) return queryChatGPT(promptText)
  if (engine.startsWith('gemini:')) return queryGemini(promptText)
  if (engine.startsWith('google_ai_overviews:')) return queryAIOverview(promptText)
  throw new Error(`Unknown engine: ${engine}`)
}

async function recomputeBatch(db: any, batchId: string) {
  const { data: batch } = await db.from('ai_visibility_batches').select('total_jobs').eq('id', batchId).single()
  if (!batch) return
  const { count: doneCount } = await db.from('ai_visibility_jobs').select('*', { count: 'exact', head: true }).eq('batch_id', batchId).eq('status', 'done')
  const { count: errCount } = await db.from('ai_visibility_jobs').select('*', { count: 'exact', head: true }).eq('batch_id', batchId).eq('status', 'error')
  const d = doneCount || 0
  const e = errCount || 0
  const finished = d + e >= (batch.total_jobs || 0)
  await db.from('ai_visibility_batches').update({
    completed_jobs: d,
    error_jobs: e,
    status: finished ? (d === 0 ? 'error' : 'done') : 'running',
    finished_at: finished ? new Date().toISOString() : null,
  }).eq('id', batchId)
}

export async function processVisibilityJob(db: any, jobId: string): Promise<{ ok: boolean; status: string; runId?: string; error?: string }> {
  const { data: job } = await db.from('ai_visibility_jobs').select('*').eq('id', jobId).single()
  if (!job) return { ok: false, status: 'missing', error: 'Job not found' }
  if (job.status === 'done') return { ok: true, status: 'done', runId: job.run_id }

  const { data: prompt } = await db.from('ai_visibility_prompts').select('prompt_text').eq('id', job.prompt_id).single()
  const { data: client } = await db.from('clients').select('name, website').eq('id', job.client_id).single()
  if (!prompt || !client) {
    await db.from('ai_visibility_jobs').update({ status: 'error', error: 'Prompt or client missing', attempts: (job.attempts || 0) + 1, finished_at: new Date().toISOString() }).eq('id', jobId)
    await recomputeBatch(db, job.batch_id)
    return { ok: false, status: 'error', error: 'Prompt or client missing' }
  }

  const brand = String(client.name).trim()
  const domain = client.website ? String(client.website).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase() : ''

  await db.from('ai_visibility_jobs').update({ status: 'running', started_at: new Date().toISOString(), attempts: (job.attempts || 0) + 1 }).eq('id', jobId)

  try {
    const { answer, citations } = await queryOneEngine(job.engine, prompt.prompt_text)
    const cited = domain ? citations.some((u) => String(u).toLowerCase().includes(domain)) : false
    const parsed = answer
      ? await parseAnswer(brand, prompt.prompt_text, answer)
      : { brand_mentioned: false, answer_position: 0, total_named: 0, competitors: [], sentiment: 'n/a' }
    const score = scoreResult(parsed, cited)

    const { data: run } = await db
      .from('ai_visibility_runs')
      .insert({ client_id: job.client_id, org_id: job.org_id, prompt_id: job.prompt_id, engine: job.engine, raw_answer: answer, citations, score })
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

    await db.from('ai_visibility_jobs').update({ status: 'done', run_id: run?.id ?? null, finished_at: new Date().toISOString() }).eq('id', jobId)
    await recomputeBatch(db, job.batch_id)
    return { ok: true, status: 'done', runId: run?.id }
  } catch (err: any) {
    await db.from('ai_visibility_jobs').update({ status: 'error', error: String(err.message).slice(0, 500), finished_at: new Date().toISOString() }).eq('id', jobId)
    await recomputeBatch(db, job.batch_id)
    return { ok: false, status: 'error', error: err.message }
  }
}

// ============================================================
// Phase 2: enqueue a batch of jobs and publish them to QStash
// ============================================================

function enginesForEnv(): string[] {
  const engines = [`perplexity:${PERPLEXITY_MODEL}`]
  if (process.env.OPENAI_API_KEY) engines.push(`chatgpt:${OPENAI_MODEL}`)
  if (process.env.GEMINI_API_KEY) engines.push(`gemini:${GEMINI_MODEL}`)
  if (dataForSeoConfigured()) engines.push('google_ai_overviews:dataforseo')
  return engines
}

export type EnqueueOutcome = {
  ok: boolean
  error?: string
  batchId?: string
  totalJobs?: number
  published?: number
  publishError?: string
}

export async function enqueueClientVisibility(db: any, clientId: string, trigger: string = 'manual'): Promise<EnqueueOutcome> {
  const { data: client } = await db.from('clients').select('id, org_id').eq('id', clientId).single()
  if (!client) return { ok: false, error: 'Client not found' }

  const { data: prompts } = await db
    .from('ai_visibility_prompts')
    .select('id')
    .eq('client_id', clientId)
    .eq('active', true)

  if (!prompts || prompts.length === 0) {
    return { ok: false, error: 'No active prompts for this client.' }
  }

  const engines = enginesForEnv()
  const totalJobs = prompts.length * engines.length

  const { data: batch, error: batchErr } = await db
    .from('ai_visibility_batches')
    .insert({ client_id: clientId, org_id: client.org_id, trigger, status: 'pending', total_jobs: totalJobs })
    .select('id')
    .single()
  if (batchErr || !batch) return { ok: false, error: `Failed to create batch: ${batchErr?.message || 'unknown'}` }

  const jobRows: any[] = []
  for (const p of prompts) {
    for (const engine of engines) {
      jobRows.push({
        batch_id: batch.id,
        client_id: clientId,
        org_id: client.org_id,
        prompt_id: p.id,
        engine,
        status: 'pending',
      })
    }
  }

  const { data: insertedJobs, error: jobsErr } = await db
    .from('ai_visibility_jobs')
    .insert(jobRows)
    .select('id')
  if (jobsErr || !insertedJobs) return { ok: false, error: `Failed to create jobs: ${jobsErr?.message || 'unknown'}` }

  const token = process.env.QSTASH_TOKEN
  if (!token) return { ok: false, error: 'QSTASH_TOKEN not configured' }
  const qstash = new QStashClient({ token, baseUrl: 'https://qstash.upstash.io' })
  const workerUrl = `${process.env.WORKER_BASE_URL || 'https://sourcehq.vercel.app'}/api/jobs/visibility`

  const pubResults = await Promise.allSettled(
    insertedJobs.map((j: any) =>
      qstash.publishJSON({
        url: workerUrl,
        body: { jobId: j.id },
        retries: 2,
      })
    )
  )
  const pubFailures = pubResults.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
  const publishError = pubFailures.length ? String(pubFailures[0].reason?.message || pubFailures[0].reason).slice(0, 300) : undefined

  return { ok: true, batchId: batch.id, totalJobs, published: insertedJobs.length - pubFailures.length, publishError }
}