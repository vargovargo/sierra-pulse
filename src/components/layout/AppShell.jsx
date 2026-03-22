import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

/** Returns current hour (0–23) in Pacific time */
function pacificHour() {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }),
    10
  )
}

/** Date exactly 6 calendar months from today, formatted "Mon D" */
function releaseDate() {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
}

function PermitReleaseNotice() {
  const [hour, setHour] = useState(pacificHour)

  useEffect(() => {
    // Refresh at the top of each hour so state updates without reload
    const ms = (60 - new Date().getMinutes()) * 60_000 - new Date().getSeconds() * 1000
    const t = setTimeout(() => setHour(pacificHour()), ms)
    return () => clearTimeout(t)
  }, [hour])

  const date   = releaseDate()
  const recLive  = hour >= 7
  const caLive   = hour >= 8

  const recText  = recLive  ? `Rec.gov ${date} live`     : `Rec.gov ${date} opens 7am`
  const caText   = caLive   ? `ReserveCalifornia live`   : `ReserveCalifornia opens 8am`
  const color    = (recLive && caLive) ? 'var(--c-go)' : recLive ? 'var(--c-warn)' : 'var(--c-text-dim)'

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        6,
      marginLeft: 'auto',
      fontSize:   11,
      fontFamily: 'var(--c-font-mono)',
      color:      'var(--c-text-dim)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      <span style={{ color }}>{recText}</span>
      <span style={{ color: 'var(--c-border)' }}>·</span>
      <span style={{ color: caLive ? 'var(--c-go)' : 'var(--c-text-dim)' }}>{caText}</span>
    </div>
  )
}

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
        <PermitReleaseNotice />
      </header>

      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
