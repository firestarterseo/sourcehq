'use client'

import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
}

const wrapStyle = { position: 'relative' as const, width: '100%' }
const inputStyle = {
  width: '100%', padding: '10px 12px', border: '0.5px solid #E5E5E3', borderRadius: '8px',
  fontSize: '13px', color: '#0D1B3E', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff',
  boxSizing: 'border-box' as const,
}
const listStyle = {
  position: 'absolute' as const, top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
  background: '#fff', border: '0.5px solid #E5E5E3', borderRadius: '8px', maxHeight: '260px',
  overflowY: 'auto' as const, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}
const optionStyle = (active: boolean) => ({
  padding: '9px 12px', fontSize: '13px', color: '#0D1B3E', cursor: 'pointer',
  background: active ? '#F5F3FF' : '#fff', fontFamily: 'DM Sans, sans-serif',
})

export default function SearchableSelect({ value, onChange, options, placeholder }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label || ''

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={containerRef} style={wrapStyle}>
      <input
        type="text"
        value={open ? query : selectedLabel}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => { setOpen(true); setQuery('') }}
        placeholder={placeholder || 'Select...'}
        style={inputStyle}
      />
      {open && (
        <div style={listStyle}>
          <div
            style={optionStyle(value === '')}
            onMouseDown={() => { onChange(''); setOpen(false); setQuery('') }}
          >
            {placeholder || 'Select...'}
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '12px', color: '#9CA3AF' }}>No matches</div>
          ) : (
            filtered.map(o => (
              <div
                key={o.value}
                style={optionStyle(o.value === value)}
                onMouseDown={() => { onChange(o.value); setOpen(false); setQuery('') }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
