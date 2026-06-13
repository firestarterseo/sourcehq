import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const maxDuration = 120

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

const FORMATS: Record<string, string> = {
  linkedin: `Write a LinkedIn post (120-200 words) from the publisher sharing this research. Open with the single most striking finding as a hook. Conversational but authoritative first-person-plural voice ("We analyzed..."). Include 2-3 concrete findings as short lines. End with a light takeaway, not a hard sell. Add 3-5 relevant hashtags on the last line. No emojis unless they genuinely add clarity.`,
  twitter: `Write an X/Twitter thread (4-6 tweets) from the publisher sharing this research. Tweet 1 is a hook with the headline finding and a number. Each subsequent tweet is one finding, under 280 characters each. Number them (1/, 2/...). Last tweet wraps with the takeaway. No hashtag spam — at most 1-2 in the final tweet.`,
  email: `Write a newsletter email block (150-250 words) from the publisher. Include a subject line (prefix it "Subject: "), a one-line preview, then a short intro, the top 3 findings as a tight list, and a closing line linking to "the full study." Warm, informative tone.`,
  gbp: `Write a Google Business Profile post (under 1500 characters, ideally 100-200 words) highlighting the single most locally-relevant finding from this research, written for a local audience. Plain, helpful, no jargon. End with a soft call to action appropriate for a local business profile.`,
  press: `Write a single press-pitch paragraph (60-100 words) a journalist could use, leading with the most newsworthy statistic framed as a trend. Include the publisher as the data source ("according to research by..."). Neutral, factual, quotable. Then add one suggested headline above it (prefix "Headline: ").`,
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const { data: { session } } = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  let format = ''
  try {
    const body = await request.json()
    format = body?.format || ''
  } catch {}

  if (!FORMATS[format]) {
    return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
  }

  const { data: report } = await adminClient()
    .from('reports')
    .select('title, content')
    .eq('id', reportId)
    .single()

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const c = report.content || {}
  const source = JSON.stringify({
    title: c.title || report.title,
    executive_summary: c.executive_summary,
    key_findings: c.wins,
    notable_patterns: c.concerns,
    what_this_means: c.opportunities,
  })

  const prompt = `You are repurposing a published market-research study into a short-form format for distribution.

THE STUDY:
${source}

TASK: ${FORMATS[format]}

Rules:
- Stay true to the study's findings and figures; invent nothing.
- Keep the researcher framing — the publisher analyzed market data, never "our performance."
- Express any inquiry/call figures only as shares/percentages, never absolute counts.
- Output ONLY the finished piece, no preamble, no explanation, no markdown code fences.`

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    return NextResponse.json({ error: `AI request failed: ${errText.slice(0, 200)}` }, { status: 500 })
  }

  const aiJson = await aiRes.json()
  const text = (aiJson.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim()

  return NextResponse.json({ format, text })
}
