import { Link, useLocation } from 'react-router-dom'

export default function AppShell({ children }) {
  const { pathname } = useLocation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <header style={{
        background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
        padding: '0 24px',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexShrink: 0,
      }}>
        <Link to="/" style={{ color: 'var(--c-text)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>
          Sierra Pulse
        </Link>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {[
            { to: '/',        label: 'Dashboard' },
            { to: '/history', label: 'Water & Snow' },
            { to: '/map',     label: 'Map' },
            { to: '/strike',  label: 'Strike' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: pathname === to ? 600 : 400,
              color: pathname === to ? 'var(--c-text)' : 'var(--c-text-muted)',
              background: pathname === to ? 'var(--c-surface-2)' : 'transparent',
              textDecoration: 'none',
            }}>
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
