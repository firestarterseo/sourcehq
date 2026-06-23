import { NextRequest, NextResponse } from 'next/server'
import { adminClient, runClientVisibility } from '@/lib/run-visibility'

export const maxDuration = 300

// Safety cap: how many clients one cron invocation will process.
// Keeps us under the function time limit. When client count grows past this,
// this loop becomes a queue-drain (find stays, process changes).
const MAX_CLIENTS_PER_RUN = 5

export async function GET(req: NextRequest) {
  // --- Auth: reject anything without the cron secret ---
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const db = adminClient()

  // --- FIND: clients that have at least one active prompt ---
  const { data: activePrompts } = await db
    .from('ai_visibility_prompts')
    .select('client_id')
    .eq('active', true)

  const clientIds = Array.from(new Set((activePrompts || []).map((p: any) => p.client_id)))
  const batch = clientIds.slice(0, MAX_CLIENTS_PER_RUN)

  // --- PROCESS: run each client through the same shared function ---
  const summary: any[] = []
  for (const clientId of batch) {
    try {
      const outcome = await runClientVisibility(db, clientId)
      summary.push({ clientId, ok: outcome.ok, count: outcome.count, overall: outcome.overall, error: outcome.error, aioError: outcome.aioError })
    } catch (err: any) {
      summary.push({ clientId, ok: false, error: err.message })
    }
  }

  return NextResponse.json({
    ran: batch.length,
    totalEligible: clientIds.length,
    skipped: Math.max(0, clientIds.length - batch.length),
    summary,
  })
}
