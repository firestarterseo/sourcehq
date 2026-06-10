interface LogoProps {
  variant?: 'dark' | 'light' | 'color'
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
}

export default function Logo({ variant = 'color', size = 'md', showTagline = false }: LogoProps) {
  const sizes = {
    sm: { dot1: 10, dot2: 9, dot3: 8, gap: 4, text: 20, tagline: 7, logoGap: 10 },
    md: { dot1: 16, dot2: 14, dot3: 13, gap: 5, text: 32, tagline: 10, logoGap: 14 },
    lg: { dot1: 24, dot2: 21, dot3: 19, gap: 7, text: 56, tagline: 13, logoGap: 20 },
  }

  const s = sizes[size]

  const colors = {
    dark: { dot: '#ffffff', source: '#ffffff', hq: '#C4B5FD', tagline: 'rgba(255,255,255,0.35)' },
    light: { dot: '#0D1B3E', source: '#0D1B3E', hq: '#7C3AED', tagline: '#7C3AED' },
    color: { dot: 'url(#logoGradient)', source: '#0D1B3E', hq: '#7C3AED', tagline: '#9CA3AF' },
  }

  const c = colors[variant]

  const dotStyle = (d: number) => ({
    width: d,
    height: d,
    borderRadius: '50%',
    background: variant === 'color' ? 'linear-gradient(135deg, #0D1B3E, #7C3AED)' : c.dot,
    flexShrink: 0 as const,
  })

  const rowStyle = { display: 'flex', gap: s.gap, justifyContent: 'center' as const }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: s.logoGap }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s.gap }}>
        <div style={rowStyle}>
          <div style={dotStyle(s.dot1)} />
        </div>
        <div style={rowStyle}>
          <div style={dotStyle(s.dot2)} />
          <div style={dotStyle(s.dot2)} />
        </div>
        <div style={rowStyle}>
          <div style={dotStyle(s.dot3)} />
          <div style={dotStyle(s.dot3)} />
          <div style={dotStyle(s.dot3)} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: s.text, letterSpacing: '-0.03em', lineHeight: 1 }}>
          <span style={{ color: c.source }}>SOURCE</span>
          <span style={{ color: c.hq }}>HQ</span>
        </div>
        {showTagline && (
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: s.tagline, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: c.tagline }}>
            Sourced not Cited™
          </div>
        )}
      </div>
    </div>
  )
}
