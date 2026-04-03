import { useNavigate } from 'react-router-dom'
import { useStrikeWindows } from '../hooks/useStrikeWindows.js'
import ZoneCard      from '../components/data/ZoneCard.jsx'
import AlertsList    from '../components/data/AlertsList.jsx'
import RoadStatusList from '../components/data/RoadStatusList.jsx'
import LoadingSpinner from '../components/shared/LoadingSpinner.jsx'
import ErrorBoundary  from '../components/shared/ErrorBoundary.jsx'

const STATUS_COLORS = {
  go:      'var(--c-go)',
  caution: 'var(--c-warn)',
  blocked: 'var(--c-stop)',
  unknown: 'var(--c-text-dim)',
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize:      12,
      fontFamily:    'var(--c-font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color:         'var(--c-text-dim)',
      marginBottom:  12,
      marginTop:     32,
      paddingBottom: 8,
      borderBottom:  '1px solid var(--c-border)',
    }}>
      {children}
    </h2>
  )
}

function SummaryLine({ windows }) {
  const counts = { go: 0, caution: 0, blocked: 0, unknown: 0 }
  for (const w of windows) counts[w.window_status] = (counts[w.window_status] ?? 0) + 1

  const parts = [
    counts.go      > 0 && { label: `${counts.go} GO`,      color: STATUS_COLORS.go },
    counts.caution > 0 && { label: `${counts.caution} CAUTION`, color: STATUS_COLORS.caution },
    counts.blocked > 0 && { label: `${counts.blocked} BLOCKED`, color: STATUS_COLORS.blocked },
    counts.unknown > 0 && { label: `${counts.unknown} PENDING`, color: STATUS_COLORS.unknown },
  ].filter(Boolean)

  if (!parts.length) return null

  return (
    <div style={{
      display:    'flex',
      gap:        16,
      flexWrap:   'wrap',
      marginBottom: 20,
      alignItems: 'center',
    }}>
      {parts.map(({ label, color }) => (
        <span key={label} style={{
          fontSize:      12,
          fontFamily:    'var(--c-font-mono)',
          color,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight:    600,
        }}>
          {label}
        </span>
      ))}
      <span style={{ fontSize: 11, color: 'var(--c-text-dim)' }}>
        across {windows.length} zones
      </span>
    </div>
  )
}

export default function PulseStatusPage() {
  const { windows, loading, error } = useStrikeWindows()
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* Page header */}
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Sierra Pulse</h1>
        <p style={{ fontSize: 13, color: 'var(--c-text-muted)', maxWidth: 520 }}>
          Eastern Sierra backcountry conditions. Snowpack, air quality, traffic, and permits
          synthesized per zone.
        </p>
      </div>

      {/* Zone grid */}
      <ErrorBoundary>
        {loading && <LoadingSpinner />}

        {error && (
          <div style={{ color: 'var(--c-stop)', fontSize: 13, padding: '16px 0' }}>
            Failed to load zone data: {error.message}
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
            No zone data yet. Deploy and invoke <code>compute-strike-windows</code>.
          </div>
        )}

        {!loading && windows.length > 0 && (
          <>
            <SummaryLine windows={windows} />
            <div data-tour="zone-cards" style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap:                 12,
            }}>
              {windows.map(w => (
                <ZoneCard
                  key={w.zone}
                  window={w}
                  onClick={() => navigate('/strike#' + encodeURIComponent(w.zone))}
                />
              ))}
            </div>
          </>
        )}
      </ErrorBoundary>

      {/* Active alerts — NWS danger/caution first, then NPS */}
      <SectionTitle>Active Alerts</SectionTitle>
      <ErrorBoundary>
        <AlertsList source="nws" limit={5} />
        <div style={{ marginTop: 8 }}>
          <AlertsList source="nps" limit={10} />
        </div>
      </ErrorBoundary>

      {/* Road & pass status */}
      <SectionTitle>Road &amp; Pass Status</SectionTitle>
      <div style={{
        background:   'var(--c-surface)',
        border:       '1px solid var(--c-border)',
        borderRadius: 8,
        overflow:     'hidden',
      }}>
        <ErrorBoundary>
          <RoadStatusList />
        </ErrorBoundary>
      </div>

    </div>
  )
}
