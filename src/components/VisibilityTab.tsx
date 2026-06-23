'use client'

import { useState, useEffect } from 'react'

interface Prompt { id: string; prompt_text: string; intent_tag?: string; active?: boolean }
interface Citation { url: string; tag?: 'own' | 'competitor' | null }
interface RunResult { engine?: string; prompt: string; mentioned?: boolean; cited?: boolean; position?: number; score?: number; sentiment?: string; citations?: Citation[]; error?: string }
interface EngineStat { overall: number; count: number }

const navy = '#0D1B3E'
const violet = '#6D28D9'
const lavender = '#EDE9FE'
const gold = '#BA7517'
const grey = '#B4B2A9'
const present = '#1D9E75'
const absent = '#D3D1C7'
const border = '0.5px solid #E5E5E3'

type EngineDef = { key: string; label: string; short: string; family: 'search' | 'conversational'; live: boolean }

const ENGINES: EngineDef[] = [
  { key: 'google_ai_overviews:dataforseo', label: 'Google AI Overviews', short: 'AIO', family: 'search', live: true },
  { key: 'google_ai_mode:dataforseo', label: 'Google AI Mode', short: 'Mode', family: 'search', live: false },
  { key: 'chatgpt:gpt-5.4-mini', label: 'ChatGPT', short: 'GPT', family: 'conversational', live: true },
  { key: 'gemini:google', label: 'Gemini', short: 'Gem', family: 'conversational', live: false },
  { key: 'perplexity:sonar-pro', label: 'Perplexity', short: 'Plx', family: 'conversational', live: true },
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
  const glyph = def.family === 'search' ? '\u25CE' : '\u2726'
  return <span style={{ fontSize: size, color, lineHeight: 1 }} aria-hidden="true">{glyph}</span>
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return '' }
}

export default function VisibilityTab({ clientId }: { clientId: string }) {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null)
  const [latest, setLatest] = useState<Record<string, RunResult>>({})
  const [engines, setEngines] = useState<Record<string, EngineStat>>({})
  const [overall, setOverall] = useState<number | null>(null)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [newPrompt, setNewPrompt] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)

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

  async function runCheck() {
    setRunning(true); setError(''); setOpen(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/ai-visibility`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Run failed'); setRunning(false); return }
      const map: Record<string, RunResult> = {}
      for (const r of (data.results || [])) map[`${r.engine || 'unknown'}|${r.prompt}`] = r
      setLatest(map)
      setEngines(data.engines || {})
      setOverall(data.overall ?? null)
      if (data.aioError) setError(`AI Overviews note: ${data.aioError}`)
      setLastRun(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))
    } catch (e: any) {
      setError(e.message || 'Run failed')
    }
    setRunning(false)
  }

  async function getSuggestions() {
    setSuggesting(true); setError('')
    try {
      const res = await fetch(`/api/clients/${clientId}/ai-visibility/suggest`)
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      if ((data.suggestions || []).length === 0 && data.note) setError(data.note)
    } catch (e: any) {
      setError(e.message || 'Could not get suggestions')
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

  const hasPrompts = prompts && prompts.length > 0
  const allResults = Object.values(latest)
  const liveResults = allResults.filter(r => !r.error)
  const hasRuns = liveResults.length > 0
  const mentionRate = hasRuns ? Math.round(liveResults.filter(r => r.mentioned).length / liveResults.length * 100) : null
  const citeRate = hasRuns ? Math.round(liveResults.filter(r => r.cited).length / liveResults.length * 100) : null
  const liveCount = ENGINES.filter(e => e.live).length

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
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>Not wired yet</div>
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
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '20px', color: navy }}>{stat ? stat.overall : '\u2014'}</span>
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
    const statusText = r.cited ? `Cited${r.position ? ` \u00B7 #${r.position}` : ''}` : r.mentioned ? 'Mentioned \u00B7 not cited' : 'Absent'
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '18px', color: navy, margin: 0 }}>AI Visibility</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0' }}>
            How often AI engines recommend this business.{lastRun ? ` Last run: ${lastRun}` : ''}
          </p>
        </div>
        {hasPrompts && (
          <button onClick={runCheck} disabled={running} style={{ background: running ? '#9CA3AF' : violet, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
            {running ? 'Running\u2026' : '\u25B6 Run Visibility Check'}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#FEF3C7', border: '0.5px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400E' }}>{error}</div>}

      {!prompts ? (
        <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading\u2026</p>
      ) : !hasPrompts ? (
        <div style={{ background: '#fff', border, borderRadius: '12px', textAlign: 'center', padding: '36px 24px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '16px', color: navy, margin: '0 0 8px' }}>Track this brand's AI visibility</h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 auto 20px', maxWidth: '440px', lineHeight: 1.6 }}>
            Add the questions your customers ask AI assistants. We'll check whether this business gets recommended across engines, and track it over time.
          </p>
          <button onClick={getSuggestions} disabled={suggesting} style={{ background: violet, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>{suggesting ? 'Loading\u2026' : 'Suggest from Search Console'}</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: lavender, borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11.5px', color: violet, fontWeight: '500' }}>Overall Score</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{overall ?? '\u2014'}{overall != null && <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: '500' }}>/100</span>}</div>
            </div>
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280' }}>Mention Rate</div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{mentionRate != null ? mentionRate + '%' : '\u2014'}</div></div>
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280' }}>Citation Rate</div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{citeRate != null ? citeRate + '%' : '\u2014'}</div></div>
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280' }}>Engines Live</div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{liveCount}<span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: '500' }}> of {ENGINES.length}</span></div></div>
          </div>

          {!hasRuns && (
            <div style={{ background: lavender, borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: navy }}>
              Your prompts are ready. Click <strong>Run Visibility Check</strong> above to see where this business shows up across AI engines.
            </div>
          )}

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
            <span style={{ fontSize: '12px', color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: present, display: 'inline-block' }} />present
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: absent, display: 'inline-block', marginLeft: '6px' }} />absent
            </span>
          </div>

          <div style={{ background: '#fff', border, borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '0.5px solid #F3F4F6', background: '#FAFAF8' }}>
              <span style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prompt</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {ENGINES.map(def => <span key={def.key} style={{ fontSize: '11px', color: '#9CA3AF', width: '30px', textAlign: 'center' }}>{def.short}</span>)}
                <span style={{ width: '21px', marginLeft: '4px' }} aria-hidden="true"></span>
              </div>
            </div>
            {prompts.map((p, i) => {
              const lastRow = i === prompts.length - 1
              return (
                <div key={p.id} style={{ borderBottom: lastRow ? 'none' : '0.5px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', gap: '12px' }}>
                    <div style={{ fontSize: '13px', color: navy, flex: 1 }}>{p.prompt_text}</div>
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
                      <button onClick={() => removePrompt(p.id)} title="Remove" style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '2px 4px', marginLeft: '4px' }}>{'\u2715'}</button>
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

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input type="text" value={newPrompt} onChange={e => setNewPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPrompt(newPrompt) }} placeholder="Add a prompt to track..." style={{ flex: 1, border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '10px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: navy, outline: 'none' }} />
            <button onClick={() => addPrompt(newPrompt)} disabled={adding || !newPrompt.trim()} style={{ background: '#fff', color: violet, border: `0.5px solid ${violet}`, borderRadius: '8px', padding: '10px 14px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Add</button>
            <button onClick={getSuggestions} disabled={suggesting} style={{ background: '#fff', color: violet, border: `0.5px solid ${violet}`, borderRadius: '8px', padding: '10px 14px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{suggesting ? '...' : '+ Suggest from Search Console'}</button>
          </div>

          {suggestions.length > 0 && (
            <div style={{ background: '#F6F4FC', border: '0.5px solid #E5E0F3', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '12px', color: violet, fontWeight: '600', marginBottom: '10px' }}>Suggested from Search Console \u00B7 tap to add</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => addPrompt(s, 'gsc-suggested')} style={{ background: '#fff', border: '0.5px solid #D8D5E3', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', color: navy, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ {s}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}



