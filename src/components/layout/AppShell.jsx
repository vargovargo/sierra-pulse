import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import TutorialModal from '../shared/TutorialModal'

/** Returns current hour (0–23) in Pacific time */
function pacificHour() {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }),
    10
  )
}

/** Format a date offset from today by N days or months */
function fmtOffset({ months = 0, days = 0 }) {
  const d = new Date()
  if (months) d.setMonth(d.getMonth() + months)
  if (days)   d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
}

function Dot({ color }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
}

function Sep({ color = 'var(--c-border)' }) {
  return <span style={{ color }}>·</span>
}

function PermitReleaseNotice() {
  const [hour, setHour] = useState(pacificHour)

  useEffect(() => {
    const ms = (60 - new Date().getMinutes()) * 60_000 - new Date().getSeconds() * 1000
    const t = setTimeout(() => setHour(pacificHour()), ms)
    return () => clearTimeout(t)
  }, [hour])

  const sixMo   = fmtOffset({ months: 6 })   // initial release window
  const twoWk   = fmtOffset({ days: 14 })    // additional permits window

  const recLive = hour >= 7
  const caLive  = hour >= 8
  const recColor = recLive ? 'var(--c-go)'  : 'var(--c-text-dim)'
  const caColor  = caLive  ? 'var(--c-go)'  : 'var(--c-text-dim)'
  const dotColor = recLive && caLive ? 'var(--c-go)' : recLive ? 'var(--c-warn)' : 'var(--c-text-dim)'

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        5,
      fontSize:   11,
      fontFamily: 'var(--c-font-mono)',
      whiteSpace: 'nowrap',
    }}>
      <Dot color={dotColor} />
      {/* Rec.gov — two release windows both open at 7am */}
      <span style={{ color: recColor }}>
        Rec.gov {sixMo} <span style={{ opacity: 0.6 }}>(6mo)</span>
        {' '}<span style={{ color: 'var(--c-border)' }}>+</span>{' '}
        {twoWk} <span style={{ opacity: 0.6 }}>(2wk)</span>
        {recLive ? ' live' : ' opens 7am'}
      </span>
      <Sep />
      {/* ReserveCalifornia — 8am */}
      <span style={{ color: caColor }}>
        ReserveCalifornia {caLive ? 'live' : 'opens 8am'}
      </span>
    </div>
  )
}

export default function AppShell({ children }) {
  const { pathname } = useLocation()
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('sierra_pulse_tutorial_seen')) {
      setShowTutorial(true)
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Permit window strip — sits above the nav row, no overflow on mobile */}
      <div style={{
        background: 'var(--c-bg)',
        borderBottom: '1px solid var(--c-border)',
        padding: '0 16px',
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flexShrink: 0,
      }}>
        <PermitReleaseNotice />
      </div>

      <header style={{
        background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
        padding: '0 16px',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        <Link to="/" style={{ color: 'var(--c-text)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', flexShrink: 0 }}>
          Sierra Pulse
        </Link>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          {[
            { to: '/',        label: 'Dashboard' },
            { to: '/history', label: 'Water & Snow' },
            { to: '/map',     label: 'Map' },
            { to: '/strike',  label: 'Strike' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: pathname === to ? 600 : 400,
              color: pathname === to ? 'var(--c-text)' : 'var(--c-text-muted)',
              background: pathname === to ? 'var(--c-surface-2)' : 'transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </Link>
          ))}
        </nav>

        <button
          onClick={() => setShowTutorial(true)}
          title="Site tour"
          style={{
            marginLeft: 'auto',
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1px solid var(--c-border)',
            background: 'var(--c-surface-2)',
            color: 'var(--c-text-muted)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ?
        </button>
      </header>

      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      {showTutorial && (
        <TutorialModal onClose={() => {
          localStorage.setItem('sierra_pulse_tutorial_seen', '1')
          setShowTutorial(false)
        }} />
      )}
    </div>
  )
}
