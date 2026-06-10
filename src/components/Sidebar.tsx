import Link from 'next/link'
import Logo from '@/components/Logo'

interface SidebarProps {
  active: string
  email: string
}

export default function Sidebar({ active, email }: SidebarProps) {
  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Clients', href: '/dashboard/clients' },
    { label: 'Reports', href: '/dashboard/reports' },
    { label: 'Connections', href: '/dashboard/connections' },
    { label: 'Insights', href: '/dashboard/insights' },
    { label: 'Settings', href: '/dashboard/settings' },
  ]

  return (
    <div style={{ width: '220px', background: '#0D1B3E', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10 }}>
      <div style={{ padding: '16px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <Logo variant="dark" size="sm" />
        </Link>
      </div>
      <nav style={{ padding: '8px', flex: 1 }}>
        {navItems.map(item => (
          <Link key={item.label} href={item.href} style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', margin: '1px 0', fontSize: '13px', fontWeight: '500', color: item.label === active ? '#C4B5FD' : 'rgba(255,255,255,0.5)', background: item.label === active ? 'rgba(109,40,217,0.15)' : 'transparent', textDecoration: 'none' }}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ padding: '12px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', marginBottom: '4px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: '#fff', flexShrink: 0 }}>FS</div>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Firestarter SEO</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{email}</div>
          </div>
        </div>
        <Link href="/auth/signout" style={{ display: 'block', padding: '7px 12px', borderRadius: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
          Sign out
        </Link>
      </div>
    </div>
  )
}