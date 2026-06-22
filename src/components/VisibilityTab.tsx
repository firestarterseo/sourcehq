'use client'

import { useState, useEffect } from 'react'

interface Prompt { id: string; prompt_text: string; intent_tag?: string; active?: boolean }
interface RunResult { engine?: string; prompt: string; mentioned?: boolean; cited?: boolean; position?: number; score?: number; error?: string }
interface EngineStat { overall: number; count: number }

const navy = '#0D1B3E'
const violet = '#6D28D9'
const lavender = '#EDE9FE'
const gold = '#BA7517'
const grey = '#B4B2A9'
const present = '#1D9E75'
const absent = '#D3D1C7'
const border = '0.5px solid #E5E5E3'

type EngineDef = { key: string; label: string; short: string; icon: string; family: 'search' | 'conversational'; live: boolean }

const ENGINES: EngineDef[] = [
  { key: 'google_ai_overviews:dataforseo', label: 'Google AI Overviews', short: 'AIO', icon: 'M12 12.7v2.6h3.6c-.16 1-.65 1.85-1.4 2.4l2.26 1.76c1.32-1.22 2.08-3 2.08-5.12 0-.5-.04-.98-.13-1.44z M12 21c1.9 0 3.5-.63 4.66-1.7l-2.27-1.76c-.63.42-1.43.67-2.39.67-1.84 0-3.4-1.24-3.96-2.9l-2.34 1.8C4.86 19.18 8.16 21 12 21z M8.04 13.51c-.14-.42-.22-.87-.22-1.34 0-.47.08-.92.22-1.34l-2.34-1.8C5.26 9.94 5 10.94 5 12s.26 2.06.7 2.97l2.34-1.46z M12 7.45c1.04 0 1.97.36 2.7 1.05l2.02-2.02C15.49 5.24 13.9 4.55 12 4.55c-3.84 0-7.14 1.82-8.96 4.66l2.34 1.8c.56-1.66 2.12-2.9 3.96-2.9z', family: 'search', live: true },
  { key: 'google_ai_mode:dataforseo', label: 'Google AI Mode', short: 'Mode', icon: '', family: 'search', live: false },
  { key: 'chatgpt:openai', label: 'ChatGPT', short: 'GPT', icon: '', family: 'conversational', live: false },
  { key: 'gemini:google', label: 'Gemini', short: 'Gem', icon: '', family: 'conversational', live: false },
  { key: 'perplexity:sonar-pro', label: 'Perplexity', short: 'Plx', icon: '', family: 'conversational', live: true },
]

function EngineIcon({ def, color, size = 18 }: { def: EngineDef; color: string; size?: number }) {
  if (def.key.startsWith('google_ai_overviews')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: '-3px' }} aria-hidden="true">
        <path d={def.icon} fill={color} />
      </svg>
    )
  }
  const glyph = def.family === 'search' ? '◎' : '✦'
  return <span style={{ fontSize: size, color, lineHeight: 1 }} aria-hidden="true">{glyph}</span>
}

function scoreColor(score: number) {
  if (score >= 70) return { bg: '#DCFCE7', fg: '#166534' }
  if (score > 0) return { bg: '#FEF3C7', fg: '#92400E' }
  return { bg: '#FEE2E2', fg: '#991B1B' }
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

  function loadHistory() {
    fetch(`/api/clients/${clientId}/ai-visibility`)
      .then(r => r.json())
      .then(data => {
        const active = (data.prompts || []).filter((p: Prompt) => p.active !== false)
        setPrompts(active)
      })
      .catch(() => setPrompts([]))
  }

  useEffect(() => { loadHistory() }, [clientId])

  async function runCheck() {
    setRunning(true); setError('')
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

  function presence(engineKey: string, promptText: string): 'present' | 'absent' {
    const r = latest[`${engineKey}|${promptText}`]
    return r && !r.error && r.mentioned ? 'present' : 'absent'
  }

  function EngineCard({ def }: { def: EngineDef }) {
    const stat = engines[def.key]
    if (!def.live) {
      return (
        <div style={{ ...engineCard, opacity: 0.65 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '7px' }}><EngineIcon def={def} color="#9CA3AF" size={16} />{def.label}</span>
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
          <span style={{ fontWeight: '600', fontSize: '14px', color: navy, display: 'flex', alignItems: 'center', gap: '7px' }}><EngineIcon def={def} color={navy} size={16} />{def.label}</span>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '20px', color: navy }}>{stat ? stat.overall : '—'}</span>
        </div>
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#F1EFE8', marginBottom: '8px' }}>
          <div style={{ width: `${Math.round(citedN / total * 100)}%`, background: gold }} />
          <div style={{ width: `${Math.round(mentionedOnlyN / total * 100)}%`, background: grey }} />
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          {citedN > 0 ? `Cited in ${citedN} of ${rows.length}` : `Not yet cited`}{mentionedOnlyN > 0 ? `, mentioned in ${mentionedOnlyN} more` : ''}
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
            {running ? 'Running…' : '▶ Run Visibility Check'}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#FEF3C7', border: '0.5px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400E' }}>{error}</div>}

      {!prompts ? (
        <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading…</p>
      ) : !hasPrompts ? (
        <div style={{ background: '#fff', border, borderRadius: '12px', textAlign: 'center', padding: '36px 24px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '16px', color: navy, margin: '0 0 8px' }}>Track this brand's AI visibility</h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 auto 20px', maxWidth: '440px', lineHeight: 1.6 }}>
            Add the questions your customers ask AI assistants. We'll check whether this business gets recommended across engines, and track it over time.
          </p>
          <button onClick={getSuggestions} disabled={suggesting} style={{ background: violet, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>{suggesting ? 'Loading…' : 'Suggest from Search Console'}</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: lavender, borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11.5px', color: violet, fontWeight: '500' }}>Overall Score</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{overall ?? '—'}{overall != null && <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: '500' }}>/100</span>}</div>
            </div>
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280' }}>Mention Rate</div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{mentionRate != null ? mentionRate + '%' : '—'}</div></div>
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280' }}>Citation Rate</div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{citeRate != null ? citeRate + '%' : '—'}</div></div>
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
              <div style={{ display: 'flex', gap: '12px' }}>
                {ENGINES.map(def => <span key={def.key} style={{ fontSize: '11px', color: '#9CA3AF', width: '30px', textAlign: 'center' }}>{def.short}</span>)}
              </div>
            </div>
            {prompts.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < prompts.length - 1 ? '0.5px solid #F3F4F6' : 'none', gap: '12px' }}>
                <div style={{ fontSize: '13px', color: navy, flex: 1 }}>{p.prompt_text}</div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {ENGINES.map(def => {
                    const lit = def.live && presence(def.key, p.prompt_text) === 'present'
                    return <span key={def.key} style={{ width: '30px', textAlign: 'center' }}><EngineIcon def={def} color={lit ? present : absent} size={18} /></span>
                  })}
                  <button onClick={() => removePrompt(p.id)} title="Remove" style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '2px 4px', marginLeft: '4px' }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input type="text" value={newPrompt} onChange={e => setNewPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPrompt(newPrompt) }} placeholder="Add a prompt to track…" style={{ flex: 1, border: '0.5px solid #E5E5E3', borderRadius: '8px', padding: '10px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: navy, outline: 'none' }} />
            <button onClick={() => addPrompt(newPrompt)} disabled={adding || !newPrompt.trim()} style={{ background: '#fff', color: violet, border: `0.5px solid ${violet}`, borderRadius: '8px', padding: '10px 14px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Add</button>
            <button onClick={getSuggestions} disabled={suggesting} style={{ background: '#fff', color: violet, border: `0.5px solid ${violet}`, borderRadius: '8px', padding: '10px 14px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{suggesting ? '…' : '+ Suggest from Search Console'}</button>
          </div>

          {suggestions.length > 0 && (
            <div style={{ background: '#F6F4FC', border: '0.5px solid #E5E0F3', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '12px', color: violet, fontWeight: '600', marginBottom: '10px' }}>Suggested from Search Console · tap to add</div>
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
