import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { adminClient, processVisibilityJob } from '@/lib/run-visibility'

export const maxDuration = 300

async function isAuthorized(req: NextRequest, rawBody: string): Promise<boolean> {
  // Path 1: cron-secret bearer (manual tests + cron)
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET || ''
  if (secret && auth === `Bearer ${secret}`) return true

  // Path 2: valid QStash signature
  const signature = req.headers.get('upstash-signature') || ''
  const cur = process.env.QSTASH_CURRENT_SIGNING_KEY || ''
  const nxt = process.env.QSTASH_NEXT_SIGNING_KEY || ''
  if (signature && cur && nxt) {
    try {
      const receiver = new Receiver({ currentSigningKey: cur, nextSigningKey: nxt })
      return await receiver.verify({ signature, body: rawBody })
    } catch {
      return false
    }
  }
  return false
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await isAuthorized(req, rawBody))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let jobId = ''
  try {
    const body = JSON.parse(rawBody || '{}')
    jobId = String(body?.jobId || body?.job_id || '')
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  const db = adminClient()
  const result = await processVisibilityJob(db, jobId)
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}