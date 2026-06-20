'use client'

import { useState, useEffect } from 'react'

interface Prompt { id: string; prompt_text: string; intent_tag?: string; active?: boolean }
interface RunResult { prompt: string; mentioned?: boolean; cited?: boolean; position?: number; score?: number; error?: string }

const navy = '#0D1B3E'
const violet = '#6D28D9'
const lavender = '#EDE9FE'
const border = '0.5px solid #E5E5E3'

function scoreColor(score: number) {
  if (score >= 70) return { bg: '#DCFCE7', fg: '#166534' }
  if (score > 0) return { bg: '#FEF3C7', fg: '#92400E' }
  return { bg: '#FEE2E2', fg: '#991B1B' }
}

export default function VisibilityTab({ clientId }: { clientId: string }) {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null)
  const [latest, setLatest] = useState<Record<string, RunResult>>({})
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
      for (const r of (data.results || [])) map[r.prompt] = r
      setLatest(map)
      setOverall(data.overall ?? null)
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
  const hasRuns = Object.keys(latest).length > 0
  const mentionRate = hasRuns ? Math.round(Object.values(latest).filter(r => r.mentioned).length / Object.values(latest).length * 100) : null
  const citeRate = hasRuns ? Math.round(Object.values(latest).filter(r => r.cited).length / Object.values(latest).length * 100) : null

  const card = { background: '#fff', border, borderRadius: '12px', padding: '16px' } as const
  const metricCard = { background: '#fff', border, borderRadius: '10px', padding: '14px' } as const

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '18px', color: navy, margin: 0 }}>AI Visibility</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0' }}>
            How often AI engines recommend this business.{lastRun ? ` Last run: ${lastRun} · Perplexity` : ''}
          </p>
        </div>
        {hasPrompts && (
          <button onClick={runCheck} disabled={running} style={{ background: running ? '#9CA3AF' : violet, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
            {running ? 'Running…' : '▶ Run Visibility Check'}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#991B1B' }}>{error}</div>}

      {!prompts ? (
        <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading…</p>
      ) : !hasPrompts ? (
        <div style={{ ...card, textAlign: 'center', padding: '36px 24px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '16px', color: navy, margin: '0 0 8px' }}>Track this brand's AI visibility</h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 auto 20px', maxWidth: '440px', lineHeight: 1.6 }}>
            Add the questions your customers ask AI assistants like ChatGPT and Perplexity. We'll check whether this business gets recommended — and track it over time.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={getSuggestions} disabled={suggesting} style={{ background: violet, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontFamily: 'DM Sans, sans-serif', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>{suggesting ? 'Loading…' : 'Suggest from Search Console'}</button>
          </div>
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
            <div style={metricCard}><div style={{ fontSize: '11.5px', color: '#6B7280' }}>Prompts Tracked</div><div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '26px', color: navy }}>{prompts.length}</div></div>
          </div>

          {!hasRuns && (
            <div style={{ background: lavender, borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: navy }}>
              Your prompts are ready. Click <strong>Run Visibility Check</strong> above to see where this business shows up in AI answers.
            </div>
          )}

          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '600', fontSize: '14px', color: navy, marginBottom: '10px' }}>Tracked Prompts</div>
          <div style={{ background: '#fff', border, borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            {prompts.map((p, i) => {
              const r = latest[p.prompt_text]
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < prompts.length - 1 ? '0.5px solid #F3F4F6' : 'none', gap: '12px' }}>
                  <div style={{ fontSize: '13px', color: navy, flex: 1 }}>{p.prompt_text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {r && !r.error ? (
                      <>
                        {r.mentioned ? <span style={{ background: scoreColor(r.score || 0).bg, color: scoreColor(r.score || 0).fg, fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px' }}>#{r.position}</span> : <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px' }}>absent</span>}
                        {r.cited && <span style={{ background: '#DCFCE7', color: '#166534', fontSize: '11px', padding: '3px 8px', borderRadius: '20px' }}>cited</span>}
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: '15px', color: scoreColor(r.score || 0).fg, minWidth: '30px', textAlign: 'right' }}>{r.score}</span>
                      </>
                    ) : <span style={{ fontSize: '12px', color: '#9CA3AF' }}>not run yet</span>}
                    <button onClick={() => removePrompt(p.id)} title="Remove" style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
                  </div>
                </div>
              )
            })}
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
