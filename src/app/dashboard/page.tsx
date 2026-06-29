import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days < 1) {
    const hrs = Math.floor(ms / (1000 * 60 * 60))
    if (hrs < 1) return 'just now'
    return `${hrs}h ago`
  }
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 mo ago'
  return `${months} mo ago`
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function Dashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  const email = session?.user?.email || ''

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: clients } = await adminSupabase
    .from('clients')
    .select('id, name, industry, active')
    .eq('active', true)
    .order('name', { ascending: true })

  const clientIds = (clients || []).map((c: any) => c.id)

  // Pull last-30-days runs across all clients, mentions for those runs,
  // prompts counts per client, and most-recent report per client.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: runs }, { data: prompts }, { data: reports }] = clientIds.length
    ? await Promise.all([
        adminSupabase
          .from('ai_visibility_runs')
          .select('id, client_id, prompt_id, engine, run_at, score')
          .in('client_id', clientIds)
          .gte('run_at', cutoff)
          .order('run_at', { ascending: true }),
        adminSupabase
          .from('ai_visibility_prompts')
          .select('id, client_id')
          .in('client_id', clientIds)
          .eq('active', true),
        adminSupabase
          .from('reports')
          .select('id, client_id, title, created_at')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const runIds = (runs || []).map((r: any) => r.id)
  const mentionsByRun = new Map<string, any>()
  if (runIds.length) {
    const BATCH = 100
    for (let i = 0; i < runIds.length; i += BATCH) {
      const slice = runIds.slice(i, i + BATCH)
      const { data: m } = await adminSupabase
        .from('ai_visibility_mentions')
        .select('run_id, brand_mentioned, brand_cited')
        .in('run_id', slice)
      for (const row of m || []) mentionsByRun.set(row.run_id, row)
    }
  }

  // Latest run per (client_id, engine, prompt_id) so we score off current state.
  const latestByTriple = new Map<string, any>()
  const lastRunByClient = new Map<string, string>()
  for (const run of runs || []) {
    const key = `${run.client_id}|${run.engine}|${run.prompt_id}`
    latestByTriple.set(key, run)
    const prev = lastRunByClient.get(run.client_id)
    if (!prev || run.run_at > prev) lastRunByClient.set(run.client_id, run.run_at)
  }

  // Per-client aggregates.
  const promptCountByClient = new Map<string, number>()
  for (const p of prompts || []) {
    promptCountByClient.set(p.client_id, (promptCountByClient.get(p.client_id) || 0) + 1)
  }

  const lastReportByClient = new Map<string, { title: string; created_at: string }>()
  for (const r of reports || []) {
    if (!lastReportByClient.has(r.client_id)) {
      lastReportByClient.set(r.client_id, { title: r.title || 'Untitled', created_at: r.created_at })
    }
  }

  type Row = {
    id: string
    name: string
    industry: string | null
    score: number | null
    mentionRate: number | null
    citationRate: number | null
    promptCount: number
    lastRunAt: string | null
    lastReport: { title: string; created_at: string } | null
  }

  const rows: Row[] = (clients || []).map((c: any) => {
    const triples = Array.from(latestByTriple.values()).filter((r: any) => r.client_id === c.id)
    const total = triples.length
    let mentionedCount = 0
    let citedCount = 0
    let scoreSum = 0
    for (const t of triples) {
      const m = mentionsByRun.get(t.id)
      if (m?.brand_mentioned) mentionedCount += 1
      if (m?.brand_cited) citedCount += 1
      scoreSum += Number(t.score) || 0
    }
    return {
      id: c.id,
      name: c.name,
      industry: c.industry,
      score: total ? Math.round(scoreSum / total) : null,
      mentionRate: total ? Math.round((mentionedCount / total) * 100) : null,
      citationRate: total ? Math.round((citedCount / total) * 100) : null,
      promptCount: promptCountByClient.get(c.id) || 0,
      lastRunAt: lastRunByClient.get(c.id) || null,
      lastReport: lastReportByClient.get(c.id) || null,
    }
  })

  // Sort worst score first, nulls last.
  rows.sort((a, b) => {
    if (a.score == null && b.score == null) return a.name.localeCompare(b.name)
    if (a.score == null) return 1
    if (b.score == null) return -1
    return a.score - b.score
  })

  const navy = '#0D1B3E'
  const violet = '#6D28D9'
  const lavender = '#EDE9FE'
  const border = '0.5px solid #E5E5E3'
  const muted = '#6B7280'

  const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, borderBottom: '0.5px solid #E5E5E3', background: '#FAFAF8' }
  const td: React.CSSProperties = { padding: '14px', fontSize: '13px', color: navy, borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'middle' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <Sidebar active="Dashboard" email={email} />
      <div style={{ marginLeft: '220px', flex: 1, background: '#F8F8F6' }}>
        <div style={{ background: '#fff', borderBottom: border, padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: navy }}>Dashboard</span>
          <Link href="/dashboard/clients/new" style={{ background: violet, color: '#fff', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>
            + Add client
          </Link>
        </div>
        <div style={{ padding: '32px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: 700, color: navy, marginBottom: '4px' }}>Client portfolio</h2>
          <p style={{ fontSize: '14px', color: muted, marginBottom: '28px' }}>
            {rows.length === 0 ? 'No active clients yet.' : `${rows.length} active client${rows.length === 1 ? '' : 's'}, sorted by AI Visibility Score (lowest first).`}
          </p>

          {rows.length === 0 ? (
            <div style={{ background: '#fff', border, borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: 600, color: navy, marginBottom: '8px' }}>No clients yet</h3>
              <p style={{ fontSize: '14px', color: muted, marginBottom: '24px' }}>Add your first client to start tracking AI visibility.</p>
              <Link href="/dashboard/clients/new" style={{ background: violet, color: '#fff', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>
                + Add your first client
              </Link>
            </div>
          ) : (
            <div style={{ background: '#fff', border, borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Client</th>
                    <th style={{ ...th, textAlign: 'right' }}>Score</th>
                    <th style={{ ...th, textAlign: 'right' }}>Mention</th>
                    <th style={{ ...th, textAlign: 'right' }}>Citation</th>
                    <th style={{ ...th, textAlign: 'right' }}>Prompts</th>
                    <th style={th}>Last Run</th>
                    <th style={th}>Last Report</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const stale = daysSince(row.lastRunAt) > 9
                    return (
                      <tr key={row.id} style={{ cursor: 'pointer' }}>
                        <td style={td}>
                          <Link href={`/dashboard/clients/${row.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: lavender, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: violet, flexShrink: 0 }}>
                              {row.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>{row.name}</div>
                              <div style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '1px' }}>{row.industry || '—'}</div>
                            </div>
                          </Link>
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                          {row.score != null ? row.score : <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {row.mentionRate != null ? `${row.mentionRate}%` : <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {row.citationRate != null ? `${row.citationRate}%` : <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{row.promptCount}</td>
                        <td style={{ ...td, color: stale ? '#A32D2D' : navy }}>
                          {fmtRelative(row.lastRunAt)}
                          {stale && row.lastRunAt && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: '#FCEBEB', color: '#A32D2D' }}>STALE</span>}
                        </td>
                        <td style={td}>
                          {row.lastReport ? (
                            <div>
                              <div style={{ fontWeight: 500 }}>{row.lastReport.title}</div>
                              <div style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '1px' }}>{fmtRelative(row.lastReport.created_at)}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#9CA3AF' }}>No reports</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
