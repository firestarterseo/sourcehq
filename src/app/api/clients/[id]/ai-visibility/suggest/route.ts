import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getGoogleAuth } from '@/lib/google-auth'

export const maxDuration = 120

const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'

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

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// Pull top GSC queries for the client (same approach as the report route)
async function getTopQueries(clientId: string): Promise<string[]> {
  const auth = await getGoogleAuth(clientId)
  const property = auth.selection.gsc_property
  if (!auth.token || !property) return []

  const res = await fetch(`${GSC_API}/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: isoDaysAgo(92),
      endDate: isoDaysAgo(2),
      dimensions: ['query'],
      rowLimit: 40,
    }),
  })
  if (!res.ok) return []
  const json = await res.json()
  return (json.rows || []).map((r: any) => r.keys[0]).filter(Boolean)
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const queries = await getTopQueries(id)
  if (queries.length === 0) {
    return NextResponse.json({ suggestions: [], note: 'No Search Console queries available for this client (GSC not connected, or no data).' })
  }

  const prompt = `You are helping build an AI visibility tracker. Below are real Google Search Console queries for a business. Your job: convert the ones that represent genuine buyer/customer intent into the natural-language QUESTIONS a person would actually ask an AI assistant (ChatGPT, Perplexity, Google AI) when looking for this kind of business or information.

RULES:
- Only convert queries that represent a customer looking for a service, product, recommendation, or answer. SKIP branded/navigational queries (the business's own name), nonsense, and queries too vague to form a question.
- Rewrite each kept query as a complete, natural question a real person would type into an AI assistant. Keep the location/intent.
- Prefer "who/what/which/how" questions a buyer would ask when choosing or researching.
- Return 8-12 suggestions max, the highest-intent ones. De-duplicate similar questions.

GSC QUERIES:
${JSON.stringify(queries)}

Respond with ONLY a JSON array of strings, no markdown, no preamble. Example: ["Who are the best ...?", "What is the cost of ...?"]`

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: `AI request failed: ${body.slice(0, 200)}` }, { status: 500 })
  }
  const json = await res.json()
  const text = (json.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
  let suggestions: string[] = []
  try {
    suggestions = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const m = text.match(/\[[\s\S]*\]/)
    if (m) try { suggestions = JSON.parse(m[0]) } catch {}
  }

  return NextResponse.json({ suggestions, sourceQueryCount: queries.length })
}
