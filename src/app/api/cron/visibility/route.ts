import { NextRequest, NextResponse } from 'next/server'
import { adminClient, runClientVisibility } from '@/lib/run-visibility'

export const maxDuration = 300

const MAX_CLIENTS_PER_RUN = 5

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const queryKey = req.nextUrl.searchParams.get('key')

  if (req.nextUrl.searchParams.get('debug') === '1') {
    return NextResponse.json({
      serverSecretLen: secret ? secret.length : 0,
      serverSecretHead: secret ? secret.slice(0, 12) : null,
      serverSecretTail: secret ? secret.slice(-6) : null,
      queryKeyLen: queryKey ? queryKey.length : 0,
      queryKeyHead: queryKey ? queryKey.slice(0, 12) : null,
      queryKeyTail: queryKey ? queryKey.slice(-6) : null,
      exactMatch: queryKey === secret,
    })
  }

  if (secret) {
    const auth = req.headers.get('authorization')
    const viaHeader = auth === `Bearer ${secret}`
    const viaQuery = queryKey === secret
    if (!viaHeader && !viaQuery) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const db = adminClient()

  const { data: activePrompts } = await db
    .from('ai_visibility_prompts')
    .select('client_id')
    .eq('active', true)

  const clientIds = Array.from(new Set((activePrompts || []).map((p: any) => p.client_id)))
  const batch = clientIds.slice(0, MAX_CLIENTS_PER_RUN)

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
