import { useStrikeWindows } from '../hooks/useStrikeWindows.js'
import StrikeWindowCard    from '../components/data/StrikeWindowCard.jsx'
import LoadingSpinner      from '../components/shared/LoadingSpinner.jsx'
import ErrorBoundary       from '../components/shared/ErrorBoundary.jsx'

const STATUS_SUMMARY = {
  go:      { color: 'var(--c-go)',   text: 'Conditions aligned. Window is open.' },
  caution: { color: 'var(--c-warn)', text: 'Mixed signals. Verify before committing.' },
  blocked: { color: 'var(--c-stop)', text: 'Conditions not met.' },
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: 12,
      fontFamily: 'var(--c-font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--c-text-dim)',
      marginBottom: 12,
      marginTop: 32,
      paddingBottom: 8,
      borderBottom: '1px solid var(--c-border)',
    }}>
      {children}
    </h2>
  )
}

export default function StrikePage() {
  const { windows, loading, error } = useStrikeWindows()

  const goZones      = windows.filter(w => w.window_status === 'go')
  const cautionZones = windows.filter(w => w.window_status === 'caution')
  const blockedZones = windows.filter(w => w.window_status === 'blocked')
  const unknownZones = windows.filter(w => w.window_status === 'unknown')

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
      <div style={{
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

      {/* AQI note */}
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

        {goZones.length > 0 && (
          <>
            <SectionTitle>Open Windows</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {goZones.map(w => (
                <StrikeWindowCard key={w.zone} window={w} />
              ))}
            </div>
          </>
        )}

        {cautionZones.length > 0 && (
          <>
            <SectionTitle>Caution</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cautionZones.map(w => (
                <StrikeWindowCard key={w.zone} window={w} />
              ))}
            </div>
          </>
        )}

        {blockedZones.length > 0 && (
          <>
            <SectionTitle>Blocked</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {blockedZones.map(w => (
                <StrikeWindowCard key={w.zone} window={w} />
              ))}
            </div>
          </>
        )}

        {unknownZones.length > 0 && (
          <>
            <SectionTitle>Pending Data</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unknownZones.map(w => (
                <StrikeWindowCard key={w.zone} window={w} />
              ))}
            </div>
          </>
        )}
      </ErrorBoundary>
    </div>
  )
}
