'use client'

import { useState, useEffect } from 'react'

interface Prompt { id: string; prompt_text: string; intent_tag?: string; active?: boolean }
interface Citation { url: string; tag?: 'own' | 'competitor' | null }
interface RunResult { engine?: string; prompt: string; mentioned?: boolean; cited?: boolean; position?: number; score?: number; sentiment?: string; citations?: Citation[]; error?: string }
interface EngineStat { overall: number; count: number }

const navy = '#0D1B3E'
const violet = '#6D28D9'
const lavender = '#EDE9FE'
const gold = '#1D9E75'
const grey = '#A8DCC5'
const present = '#1D9E75'
const absent = '#D3D1C7'
const border = '0.5px solid #E5E5E3'

type EngineDef = { key: string; label: string; short: string; family: 'search' | 'conversational'; live: boolean }

const ENGINES: EngineDef[] = [
  { key: 'google_ai_overviews:cloro', label: 'Google AI Overviews', short: 'AIO', family: 'search', live: true },
  { key: 'google_ai_mode:cloro', label: 'Google AI Mode', short: 'Mode', family: 'search', live: true },
  { key: 'chatgpt:gpt-5.4-mini', label: 'ChatGPT', short: 'GPT', family: 'conversational', live: true },
  { key: 'gemini:gemini-3.5-flash', label: 'Gemini', short: 'Gem', family: 'conversational', live: true },
  { key: 'perplexity:sonar-pro', label: 'Perplexity', short: 'Plx', family: 'conversational', live: true },
  { key: 'grok:cloro', label: 'Grok', short: 'Grk', family: 'conversational', live: true },
  { key: 'copilot:cloro', label: 'Copilot', short: 'Cop', family: 'conversational', live: true },
]

function EngineGlyph({ def, color, size = 18 }: { def: EngineDef; color: string; size?: number }) {
  if (def.key.startsWith('google')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: '-3px' }} aria-hidden="true">
        <path d="M21.8 12.2c0-.7-.06-1.37-.18-2.02H12v3.83h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.4 3.04-7.45z" fill={color}/>
        <path d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.3-2.56c-.92.62-2.1.98-3.32.98-2.55 0-4.71-1.72-5.48-4.04H3.1v2.64A10 10 0 0 0 12 22z" fill={color}/>
        <path d="M6.52 13.96a6 6 0 0 1 0-3.92V7.4H3.1a10 10 0 0 0 0 9.2l3.42-2.64z" fill={color}/>
        <path d="M12 5.98c1.47 0 2.8.5 3.84 1.5l2.88-2.88C16.96 2.98 14.7 2 12 2A10 10 0 0 0 3.1 7.4l3.42 2.64C7.29 7.7 9.45 5.98 12 5.98z" fill={color}/>
      </svg>
    )
  }
  if (def.family === 'search') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: '-3px' }} aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill={color} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: '-3px' }} aria-hidden="true">
      <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" fill={color} />
    </svg>
  )
}

function InfoTip({ text }: { text: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} className="vt-infotip">
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '13px', height: '13px', borderRadius: '50%', border: '0.5px solid #B4B2A9', color: '#6B7280', fontSize: '9px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'help' }}>i</span>
      <span className="vt-infotip-bubble" style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#0D1B3E', color: '#fff', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 400, padding: '8px 10px', borderRadius: '6px', whiteSpace: 'normal', width: '220px', lineHeight: 1.4, opacity: 0, pointerEvents: 'none', transition: 'opacity 0.15s', zIndex: 10, textAlign: 'left' }}>{text}</span>
      <style>{'.vt-infotip:hover .vt-infotip-bubble { opacity: 1 !important; }'}</style>
    </span>
  )
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return '' }
}

function TrendChart({ data, weeks, onWeeksChange, loading }: { data: { week_labels: string[]; points: { week: string; cited: number; mentioned: number; absent: number; total: number }[]; total_runs: number } | null; weeks: number; onWeeksChange: (w: number) => void; loading: boolean }) {
  const W = 720
  const H = 220
  const padL = 36, padR = 16, padT = 16, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const weekLabels = data?.week_labels || []
  const points = data?.points || []
  const maxTotal = Math.max(1, ...points.map(p => p.total))
  const hasPoints = weekLabels.length > 0

  function x(i: number) {
    const slotW = innerW / Math.max(weekLabels.length, 1)
    return padL + slotW * i
  }
  function y(count: number) {
    return padT + innerH - (count / maxTotal) * innerH
  }

  const navy = '#0D1B3E'
  const muted = '#6B7280'
  const citedColor = '#1D9E75'
  const mentionedColor = '#A8DCC5'
  const absentColor = '#F1EFE8'

  const ranges = [
    { label: '4w', value: 4 },
    { label: '8w', value: 8 },
    { label: '13w', value: 13 },
    { label: '26w', value: 26 },
    { label: '52w', value: 52 },
    { label: 'All', value: 520 },
  ]

  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '12px', padding: '16px 18px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '14px', color: navy }}>Visibility over time</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {ranges.map(r => (
            <button key={r.value} onClick={() => onWeeksChange(r.value)} style={{ background: weeks === r.value ? '#EDE9FE' : '#fff', border: '0.5px solid ' + (weeks === r.value ? '#6D28D9' : '#E5E5E3'), color: weeks === r.value ? '#6D28D9' : muted, borderRadius: '6px', padding: '4px 10px', fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>{r.label}</button>
          ))}
        </div>
      </div>

      {!hasPoints ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: muted, fontSize: '13px' }}>
          {loading ? 'Loading...' : 'Not enough data yet. Trend fills in as weekly runs accumulate.'}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const val = Math.round(maxTotal * frac)
            return (
              <g key={frac}>
                <line x1={padL} y1={y(val)} x2={padL + innerW} y2={y(val)} stroke="#F1EFE8" strokeWidth="1" />
                <text x={padL - 6} y={y(val) + 3} fontSize="10" fill={muted} textAnchor="end" fontFamily="DM Sans, sans-serif">{val}</text>
              </g>
            )
          })}
          {points.map((p, i) => {
            const slotW = innerW / Math.max(weekLabels.length, 1)
            const barPad = slotW * 0.2
            const barW = slotW - barPad * 2
            const bx = x(i) + barPad
            const citedH = (p.cited / maxTotal) * innerH
            const mentionedH = (p.mentioned / maxTotal) * innerH
            const absentH = (p.absent / maxTotal) * innerH
            const bottomY = padT + innerH
            const citedY = bottomY - citedH
            const mentionedY = citedY - mentionedH
            const absentY = mentionedY - absentH
            const d = new Date(p.week)
            const lbl = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
            const showLabel = weekLabels.length <= 12 || i % Math.ceil(weekLabels.length / 8) === 0
            return (
              <g key={p.week}>
                {p.cited > 0 && <rect x={bx} y={citedY} width={barW} height={citedH} fill={citedColor} />}
                {p.mentioned > 0 && <rect x={bx} y={mentionedY} width={barW} height={mentionedH} fill={mentionedColor} />}
                {p.absent > 0 && <rect x={bx} y={absentY} width={barW} height={absentH} fill={absentColor} />}
                {showLabel && <text x={x(i) + slotW / 2} y={H - 8} fontSize="10" fill={muted} textAnchor="middle" fontFamily="DM Sans, sans-serif">{lbl}</text>}
              </g>
            )
          })}
        </svg>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid #F3F4F6' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: muted }}>
          <span style={{ width: '10px', height: '10px', background: citedColor, display: 'inline-block', borderRadius: '2px' }} />
          Cited
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: muted }}>
          <span style={{ width: '10px', height: '10px', background: mentionedColor, display: 'inline-block', borderRadius: '2px' }} />
          Mentioned (not cited)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: muted }}>
          <span style={{ width: '10px', height: '10px', background: absentColor, display: 'inline-block', borderRadius: '2px', border: '0.5px solid #E5E5E3' }} />
          Absent
        </span>
      </div>
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#9CA3AF' }}>Each bar shows total prompt by engine runs for the week.</div>
    </div>
  )
}
export default function VisibilityTab({ clientId }: { clientId: string }) {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null)
  const [latest, setLatest] = useState<Record<string, RunResult>>({})
  const [engines, setEngines] = useState<Record<string, EngineStat>>({})
  const [overall, setOverall] = useState<number | null>(null)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [suggestNote, setSuggestNote] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [manageMode, setManageMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [trendWeeks, setTrendWeeks] = useState<number>(8)
  const [trendData, setTrendData] = useState<{ week_labels: string[]; points: { week: string; cited: number; mentioned: number; absent: number; total: number }[]; total_runs: number } | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)

  function loadHistory() {
    fetch(`/api/clients/${clientId}/ai-visibility`)
      .then(r => r.json())
      .then(data => {
        const active = (data.prompts || []).filter((p: Prompt) => p.active !== false)
        setPrompts(active)
        const map: Record<string, RunResult> = {}
        for (const r of (data.results || [])) map[`${r.engine || 'unknown'}|${r.prompt}`] = r
        setLatest(map)
        setEngines(data.engines || {})
        setOverall(data.overall ?? null)
        setLastRun(data.lastRunAt ? fmtTime(data.lastRunAt) : null)
      })
      .catch(() => setPrompts([]))
  }

  useEffect(() => { loadHistory() }, [clientId])

  useEffect(() => {
    let cancelled = false
    setTrendLoading(true)
    fetch('/api/clients/' + clientId + '/ai-visibility/trend?weeks=' + trendWeeks)
      .then(r => r.json())
      .then(data => { if (!cancelled) setTrendData(data) })
      .catch(() => { if (!cancelled) setTrendData(null) })
      .finally(() => { if (!cancelled) setTrendLoading(false) })
    return () => { cancelled = true }
  }, [clientId, trendWeeks])

  async function runCheck() {
    setRunning(true); setError(''); setOpen(null); setProgress(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/ai-visibility`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || !data.batchId) {
        setError('Could not start the check. Please try again.')
        setRunning(false)
        return
      }
      const batchId = data.batchId
      setProgress({ done: 0, total: data.totalJobs || 0 })
      const poll = async (): Promise<void> => {
        try {
          const sr = await fetch(`/api/clients/${clientId}/ai-visibility/batch?batchId=${batchId}`)
          const sd = await sr.json().catch(() => null)
          const b = sd?.batch
          if (b) {
            setProgress({ done: b.done, total: b.total })
            if (b.status === 'done' || b.status === 'error' || (b.total > 0 && b.done >= b.total)) {
              await loadHistory()
              setRunning(false)
              setProgress(null)
              return
            }
          }
        } catch {}
        setTimeout(poll, 3000)
      }
      setTimeout(poll, 2500)
    } catch (e: any) {
      setError('Could not start the check. Please try again.')
      setRunning(false)
      setProgress(null)
    }
  }

  async function getSuggestions() {
    setSuggesting(true); setError(''); setSuggestNote('')
    try {
      const res = await fetch(`/api/clients/${clientId}/ai-visibility/suggest`)
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      if ((data.suggestions || []).length === 0) setSuggestNote(data.note || 'No suggestions available for this client.')
    } catch (e: any) {
      setSuggestNote(e.message || 'Could not get suggestions')
    }
    setSuggesting(false)
  }

  async function addPrompt(text: string, tag = 'manual') {
    if (!text.trim()) return
    setAdding(true)
    await fetch(`/api/clients/${clientId}/ai-visibility/prompts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text.trim(), intent_tag: tag }),
    })
    setNewPrompt('')
    setSuggestions(prev => prev.filter(s => s !== text))
    setAdding(false)
    loadHistory()
  }

  async function removePrompt(promptId: string) {
    await fetch(`/api/clients/${clientId}/ai-visibility/prompts`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_id: promptId }),
    })
    loadHistory()
  }

  function toggleSelected(promptId: string) {
    setSelected(prev => { const next = new Set(prev); if (next.has(promptId)) next.delete(promptId); else next.add(promptId); return next })
  }
  async function removeSelected() {
    for (const promptId of Array.from(selected)) {
      await fetch(`/api/clients/${clientId}/ai-visibility/prompts`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt_id: promptId }) })
    }
    setSelected(new Set()); setManageMode(false); loadHistory()
  }
  const hasPrompts = prompts && prompts.length > 0
  const allResults = Object.values(latest)
  const liveResults = allResults.filter(r => !r.error)
  const hasRuns = liveResults.length > 0
  const inSetup = !hasRuns
  const mentionRate = hasRuns ? Math.round(liveResults.filter(r => r.mentioned).length / liveResults.length * 100) : null
  const citeRate = hasRuns ? Math.round(liveResults.filter(r => r.cited).length / liveResults.length * 100) : null
  const promptCount = prompts ? prompts.length : 0

  const searchEngines = ENGINES.filter(e => e.family === 'search')
  const convoEngines = ENGINES.filter(e => e.family === 'conversational')

  const metricCard = { background: '#fff', border, borderRadius: '10px', padding: '14px' } as const
  const engineCard = { background: '#fff', border, borderRadius: '12px', padding: '16px 18px' } as const

  function result(engineKey: string, promptText: string): RunResult | undefined {
    return latest[`${engineKey}|${promptText}`]
  }
  function isPresent(engineKey: string, promptText: string) {
    const r = result(engineKey, promptText)
    return !!(r && !r.error && r.mentioned)
  }

  function EngineCard({ def }: { def: EngineDef }) {
    const stat = engines[def.key]
    if (!def.live) {
      return (
        <div style={{ ...engineCard, opacity: 0.65 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '7px' }}><EngineGlyph def={def} color="#9CA3AF" size={16} />{def.label}</span>
            <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px' }}>Roadmap</span>
          </div>
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>Coming soon</div>
        </div>
      )
    }
    const rows = liveResults.filter(r => r.engine === def.key)
    const citedN = rows.filter(r => r.cited).length
    const mentionedOnlyN = rows.filter(r => r.mentioned && !r.cited).length
    const total = rows.length || 1
    return (
      <div style={engineCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontWeight: '600', fontSize: '14px', color: navy, display: 'flex', alignItems: 'center', gap: '7px' }}><EngineGlyph def={def} color={navy} size={16} />{def.label}</span>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '20px', color: navy }}>{stat ? stat.overall : '-'}</span>
        </div>
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#F1EFE8', marginBottom: '8px' }}>
          <div style={{ width: `${Math.round(citedN / total * 100)}%`, background: gold }} />
          <div style={{ width: `${Math.round(mentionedOnlyN / total * 100)}%`, background: grey }} />
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          {citedN > 0 ? `Cited in ${citedN} of ${rows.length}` : 'Not yet cited'}{mentionedOnlyN > 0 ? `, mentioned in ${mentionedOnlyN} more` : ''}
        </div>
      </div>
    )
  }

  function DetailPanel({ def, r }: { def: EngineDef; r: RunResult }) {
    const statusBg = r.cited ? '#E1F5EE' : r.mentioned ? '#F1EFE8' : '#FCEBEB'
    const statusFg = r.cited ? '#0F6E56' : r.mentioned ? '#5F5E5A' : '#A32D2D'
    const statusText = r.cited ? `Cited${r.position ? ` #${r.position}` : ''}` : r.mentioned ? 'Mentioned - not cited' : 'Absent'
    return (
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ background: '#FAFAF8', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <EngineGlyph def={def} color={violet} size={16} />
            <span style={{ fontWeight: '600', fontSize: '13px', color: navy }}>{def.label}</span>
            <span style={{ background: statusBg, color: statusFg, fontSize: '11px', fontWeight: '600', padding: '2px 9px', borderRadius: '20px' }}>{statusText}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '17px', color: navy }}>{r.score}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Sources cited in this answer</div>
          {(r.citations && r.citations.length > 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {r.citations.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  {c.tag === 'own' && <span style={{ background: '#FAEEDA', color: '#854F0B', fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '4px' }}>You</span>}
                  {c.tag === 'competitor' && <span style={{ background: '#FBEAF0', color: '#993556', fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '4px' }}>Competitor</span>}
                  <span style={{ color: c.tag === 'own' ? '#185FA5' : '#4B5563', wordBreak: 'break-all' }}>{c.url.replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#9CA3AF' }}>No sources captured for this answer.</div>
          )}
          {!r.cited && r.mentioned && (
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '10px', fontStyle: 'italic' }}>Named in the answer but no link earned. Published research that third parties cite is the lever to convert this to cited.</div>
          )}
        </div>
      </div>
    )
  }

  function SuggestionChips() {
    if (suggestions.length === 0) return null
    return (
      <div style={{ background: '#F6F4FC', border: '0.5px solid #E5E0F3', borderRadius: '10px', padding: '14px 16px', marginTop: '16px', textAlign: 'left' }}>
        <div style={{ fontSize: '12px', color: violet, fontWeight: '600', marginBottom: '10px' }}>Suggested from Search Console - tap to add</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => addPrompt(s, 'gsc-suggested')} style={{ background: '#fff', border: '0.5px solid #D8D5E3', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', color: navy, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ {s}</button>
          ))}
        </div>
      </div>
    )
  }

  function AddRow() {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <input type="text" value={newPrompt} onChange={e => setNewPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPrompt(newPrompt) }} placeholder="Add a prompt to track..." style={{ flex: 1, border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '10px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: navy, outline: 'none' }} />
        <button onClick={() => addPrompt(newPrompt)} disabled={adding || !newPrompt.trim()} style={{ background: violet, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Add</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '18px', color: navy, margin: 0 }}>AI Visibility</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0' }}>
            How often AI engines recommend this business.{lastRun ? ` Last run: ${lastRun}` : ''}
          </p>
        </div>
        {hasRuns && (
          <button onClick={runCheck} disabled={running} style={{ background: running ? '#9CA3AF' : violet, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
            {running ? (progress && progress.total ? 'Running... ' + progress.done + '/' + progress.total : 'Running...') : 'Re-run Check'}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#FEF3C7', border: '0.5px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400E' }}>{error}</div>}

      {!prompts ? (
        <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading...</p>
      ) : inSetup ? (
        <div style={{ background: '#fff', border, borderRadius: '12px', padding: '28px 24px' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '16px', color: navy, margin: '0 0 6px', textAlign: 'center' }}>Set up tracking for this brand</h3>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px', lineHeight: 1.6, textAlign: 'center' }}>
              Add the questions your customers ask AI assistants. Add as many as you like, then run the first check.
            </p>

            <AddRow />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '0.5px', background: '#E5E5E3' }} />
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>or pull from real search data</span>
              <div style={{ flex: 1, height: '0.5px', background: '#E5E5E3' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <button onClick={getSuggestions} disabled={suggesting} style={{ background: '#fff', color: violet, border: `0.5px solid ${violet}`, borderRadius: '8px', padding: '10px 18px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>{suggesting ? 'Loading...' : 'Suggest from Search Console'}</button>
              {suggestNote && suggestions.length === 0 && <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '12px' }}>{suggestNote}</p>}
            </div>

            <SuggestionChips />

            <div style={{ marginTop: '24px', borderTop: '0.5px solid #F3F4F6', paddingTop: '18px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>Prompts added ({promptCount})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                {prompts.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAF8', borderRadius: '8px', padding: '9px 12px' }}>
                    <span style={{ fontSize: '13px', color: navy }}>{p.prompt_text}</span>
                    <button onClick={() => removePrompt(p.id)} title="Remove" style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '2px 4px' }}>{'x'}</button>
                  </div>
                ))}
              </div>
              <button onClick={runCheck} disabled={running || promptCount === 0} style={{ width: '100%', background: running ? '#9CA3AF' : violet, color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 16px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                {running ? (progress && progress.total ? 'Running checks... ' + progress.done + ' of ' + progress.total : 'Running first check...') : `Check Visibility (${promptCount} prompt${promptCount === 1 ? '' : 's'})`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: lavender, borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11.5px', color: violet, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px' }}>Overall Score<InfoTip text="Average score across every prompt by engine combination. 100 = cited in position 1, 80 = cited in lower positions, 50 = mentioned but not cited, 0 = absent." /></div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{overall ?? '-'}{overall != null && <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: '500' }}>/100</span>}</div>
            </div>
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '5px' }}>Mention Rate<InfoTip text="Percentage of prompt by engine runs where the brand is named anywhere in the answer, cited or not." /></div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{mentionRate != null ? mentionRate + '%' : '-'}</div></div>
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '5px' }}>Citation Rate<InfoTip text="Percentage of prompt by engine runs where the brand's website is linked as a source in the answer." /></div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{citeRate != null ? citeRate + '%' : '-'}</div></div>
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '5px' }}>Prompts Tracked<InfoTip text="Number of prompts actively monitored for this client across all engines." /></div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{promptCount}</div></div>
          </div>

          <TrendChart data={trendData} weeks={trendWeeks} onWeeksChange={setTrendWeeks} loading={trendLoading} />

          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '14px', color: navy, margin: '0 0 8px' }}>Search-feature engines</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {searchEngines.map(def => <EngineCard key={def.key} def={def} />)}
          </div>

          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '14px', color: navy, margin: '0 0 8px' }}>Conversational engines</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {convoEngines.map(def => <EngineCard key={def.key} def={def} />)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '14px', color: navy }}>Tracked Prompts</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {manageMode && selected.size > 0 && (<button onClick={removeSelected} style={{ background: '#FCEBEB', color: '#A32D2D', border: '0.5px solid #F0C9C9', borderRadius: '7px', padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>Remove selected ({selected.size})</button>)}
              {!manageMode && (<span style={{ fontSize: '12px', color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: present, display: 'inline-block' }} />present
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: absent, display: 'inline-block', marginLeft: '6px' }} />absent
            </span>)}
              <button onClick={() => { setManageMode(!manageMode); setSelected(new Set()); setOpen(null) }} style={{ background: 'transparent', color: violet, border: '0.5px solid ' + violet, borderRadius: '7px', padding: '5px 12px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '12px', cursor: 'pointer', marginLeft: '4px' }}>{manageMode ? 'Done' : 'Manage'}</button>
          </div>
          </div>

          <div style={{ background: '#fff', border, borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '0.5px solid #F3F4F6', background: '#FAFAF8' }}>
              <span style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prompt</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                {ENGINES.map(def => <span key={def.key} style={{ fontSize: '11px', color: '#9CA3AF', width: '30px', textAlign: 'center' }}>{def.short}</span>)}
              </div>
            </div>
            {prompts.map((p, i) => {
              const lastRow = i === prompts.length - 1
              return (
                <div key={p.id} style={{ borderBottom: lastRow ? 'none' : '0.5px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>{manageMode && (<input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: violet, flexShrink: 0 }} />)}<span style={{ fontSize: '13px', color: navy }}>{p.prompt_text}</span></div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {ENGINES.map(def => {
                        const lit = def.live && isPresent(def.key, p.prompt_text)
                        const hasData = def.live && !!result(def.key, p.prompt_text)
                        const cellKey = `${p.id}|${def.key}`
                        return (
                          <span
                            key={def.key}
                            onClick={() => { if (hasData) setOpen(open === cellKey ? null : cellKey) }}
                            style={{ width: '30px', textAlign: 'center', cursor: hasData ? 'pointer' : 'default' }}
                          >
                            <EngineGlyph def={def} color={lit ? present : absent} size={18} />
                          </span>
                        )
                      })}
                      
                    </div>
                  </div>
                  {ENGINES.map(def => {
                    const cellKey = `${p.id}|${def.key}`
                    const r = result(def.key, p.prompt_text)
                    if (open !== cellKey || !r) return null
                    return <DetailPanel key={def.key} def={def} r={r} />
                  })}
                </div>
              )
            })}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <AddRow />
            <div style={{ marginTop: '8px', textAlign: 'right' }}>
              <button onClick={getSuggestions} disabled={suggesting} style={{ background: '#fff', color: violet, border: `0.5px solid ${violet}`, borderRadius: '8px', padding: '8px 14px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{suggesting ? '...' : '+ Suggest from Search Console'}</button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div style={{ background: '#F6F4FC', border: '0.5px solid #E5E0F3', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '12px', color: violet, fontWeight: '600', marginBottom: '10px' }}>Suggested from Search Console - tap to add</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => addPrompt(s, 'gsc-suggested')} style={{ background: '#fff', border: '0.5px solid #D8D5E3', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', color: navy, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ {s}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    
      {running && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(13, 27, 62, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '40px 48px',
            maxWidth: '420px', width: '90%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{
              width: '40px', height: '40px', margin: '0 auto 24px',
              border: '3px solid #EDE9FE', borderTopColor: '#6D28D9',
              borderRadius: '50%', animation: 'sourcehq-vis-spin 0.8s linear infinite',
            }} />
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: 600, color: '#0D1B3E', marginBottom: '8px' }}>
              Running visibility checks
            </h3>
            <p style={{ fontSize: '14px', color: '#6D28D9', fontWeight: 500, marginBottom: '6px', minHeight: '20px' }}>
              {progress && progress.total > 0 ? `${progress.done} of ${progress.total} checks complete` : 'Starting...'}
            </p>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
              Querying each AI engine for every prompt. Please keep this tab open.
            </p>
          </div>
          <style>{`@keyframes sourcehq-vis-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}









































