import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const maxDuration = 300

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_MODEL = 'sonar-pro'

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

// --- 1. Query Perplexity for one prompt ---
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

// --- 2. Parse the answer with Claude (language extraction only) ---
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

// --- 3. Deterministic score (code, never the LLM) ---
function scoreResult(parsed: any, cited: boolean) {
  let score = 0
  if (cited) score += 50
  if (parsed.brand_mentioned) score += 30
  if (parsed.brand_mentioned && parsed.answer_position > 0) {
    score += Math.max(2, 20 - (parsed.answer_position - 1) * 4)
  }
  return Math.min(100, score)
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

  return NextResponse.json({ runs: runs || [], prompts: prompts || [] })
}

// --- POST: execute a visibility run across all active prompts ---
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
  const domain = client.website ? String(client.website).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() : ''

  const { data: prompts } = await db
    .from('ai_visibility_prompts')
    .select('id, prompt_text')
    .eq('client_id', id)
    .eq('active', true)

  if (!prompts || prompts.length === 0) {
    return NextResponse.json({ error: 'No active prompts for this client. Add prompts to ai_visibility_prompts first.' }, { status: 400 })
  }

  const engine = `perplexity:${PERPLEXITY_MODEL}`
  const results: any[] = []

  for (const p of prompts) {
    try {
      const { answer, citations } = await queryPerplexity(p.prompt_text)
      const cited = domain ? citations.some((u) => String(u).toLowerCase().includes(domain)) : false
      const parsed = await parseAnswer(brand, p.prompt_text, answer)
      const score = scoreResult(parsed, cited)

      const { data: run } = await db
        .from('ai_visibility_runs')
        .insert({ client_id: id, prompt_id: p.id, engine, raw_answer: answer, citations, score })
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

      results.push({ prompt: p.prompt_text, mentioned: !!parsed.brand_mentioned, cited, position: parsed.answer_position, score })
    } catch (err: any) {
      results.push({ prompt: p.prompt_text, error: err.message })
    }
    await new Promise((r) => setTimeout(r, 1200))
  }

  const scored = results.filter((r) => !r.error)
  const overall = scored.length ? Math.round(scored.reduce((a, r) => a + r.score, 0) / scored.length) : 0

  return NextResponse.json({ engine, overall, count: results.length, results })
}
