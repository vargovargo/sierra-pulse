import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStrikeWindows } from '../hooks/useStrikeWindows.js'
import StrikeWindowCard    from '../components/data/StrikeWindowCard.jsx'
import LoadingSpinner      from '../components/shared/LoadingSpinner.jsx'
import ErrorBoundary       from '../components/shared/ErrorBoundary.jsx'

// Zone → area mapping — derived from zone_config.ts, no DB column needed
const ZONE_AREA = {
  'North Lake / Piute Pass':        'Eastern Sierra',
  'Lake Sabrina':                   'Eastern Sierra',
  'South Lake / Bishop Pass':       'Eastern Sierra',
  'Big Pine Creek':                 'Eastern Sierra',
  'Pine Creek':                     'Eastern Sierra',
  'Rock Creek / Little Lakes Valley': 'Eastern Sierra',
  'Twin Lakes / Matterhorn':        'Hoover Wilderness',
  'Saddlebag Lake':                 'Hoover Wilderness',
}

const AREAS = ['Eastern Sierra', 'Hoover Wilderness']

function areaOf(w) {
  return ZONE_AREA[w.zone] ?? 'Other'
}

function AreaTitle({ children }) {
  return (
    <h2 style={{
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--c-text)',
      marginBottom: 4,
      marginTop: 40,
    }}>
      {children}
    </h2>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 style={{
      fontSize: 11,
      fontFamily: 'var(--c-font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--c-text-dim)',
      marginBottom: 10,
      marginTop: 20,
      paddingBottom: 6,
      borderBottom: '1px solid var(--c-border)',
    }}>
      {children}
    </h3>
  )
}

function card(w) {
  return (
    <div key={w.zone} id={encodeURIComponent(w.zone)}>
      <StrikeWindowCard window={w} />
    </div>
  )
}

function AreaSection({ area, windows }) {
  const zones   = windows.filter(w => areaOf(w) === area)
  const go      = zones.filter(w => w.window_status === 'go')
  const caution = zones.filter(w => w.window_status === 'caution')
  const blocked = zones.filter(w => w.window_status === 'blocked')
  const unknown = zones.filter(w => w.window_status === 'unknown')

  if (!zones.length) return null

  return (
    <div>
      <AreaTitle>{area}</AreaTitle>
      {go.length > 0 && (
        <>
          <SectionTitle>Open Windows</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{go.map(card)}</div>
        </>
      )}
      {caution.length > 0 && (
        <>
          <SectionTitle>Caution</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{caution.map(card)}</div>
        </>
      )}
      {blocked.length > 0 && (
        <>
          <SectionTitle>Blocked</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{blocked.map(card)}</div>
        </>
      )}
      {unknown.length > 0 && (
        <>
          <SectionTitle>Pending Data</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{unknown.map(card)}</div>
        </>
      )}
    </div>
  )
}

export default function StrikePage() {
  const { windows, loading, error } = useStrikeWindows()
  const location = useLocation()

  useEffect(() => {
    if (loading || !windows.length || !location.hash) return
    const el = document.getElementById(location.hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, windows.length, location.hash])

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Strike Windows</h1>
        <p style={{ fontSize: 13, color: 'var(--c-text-muted)', maxWidth: 520 }}>
          Snowpack, air quality, boot traffic, and permit availability synthesized per zone.
          A strike window opens when all signals align.
        </p>
      </div>

      {/* Scoring legend */}
      <div data-tour="strike-cards" style={{
        background:   'var(--c-surface)',
        border:       '1px solid var(--c-border)',
        borderRadius: 8,
        padding:      '12px 16px',
        display:      'flex',
        gap:          24,
        flexWrap:     'wrap',
        marginBottom: 8,
        fontSize:     12,
        color:        'var(--c-text-dim)',
      }}>
        <span>Score 0–100:</span>
        <span style={{ color: 'var(--c-go)' }}>70–100 → GO</span>
        <span style={{ color: 'var(--c-warn)' }}>40–69 → CAUTION</span>
        <span style={{ color: 'var(--c-stop)' }}>0–39 / AQI &gt;150 → BLOCKED</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--c-text-dim)', marginBottom: 24 }}>
        AQI &gt; 150 blocks the window regardless of other signals. AQI 101–150 caps the score at 60.
      </p>

      <ErrorBoundary>
        {loading && <LoadingSpinner />}

        {error && (
          <div style={{ color: 'var(--c-stop)', fontSize: 13, padding: 16 }}>
            Failed to load strike windows: {error.message}
          </div>
        )}

        {!loading && windows.length === 0 && (
          <div style={{
            background:   'var(--c-surface)',
            border:       '1px solid var(--c-border)',
            borderRadius: 8,
            padding:      32,
            textAlign:    'center',
            color:        'var(--c-text-dim)',
            fontSize:     13,
          }}>
            No strike windows computed yet.
            <br />
            <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              Deploy and invoke <code>compute-strike-windows</code> to populate this page.
            </span>
          </div>
        )}

        {!loading && windows.length > 0 && AREAS.map(area => (
          <AreaSection key={area} area={area} windows={windows} />
        ))}
      </ErrorBoundary>
    </div>
  )
}
