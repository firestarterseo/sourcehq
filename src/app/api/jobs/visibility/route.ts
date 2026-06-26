import { NextRequest, NextResponse } from 'next/server'
import { adminClient, processVisibilityJob } from '@/lib/run-visibility'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET || ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let jobId = ''
  try {
    const body = await req.json()
    jobId = String(body?.jobId || body?.job_id || '')
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  const db = adminClient()
  const result = await processVisibilityJob(db, jobId)
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}