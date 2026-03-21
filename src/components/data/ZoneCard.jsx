/**
 * ZoneCard — compact zone status card for the home page grid.
 * Shows strike window score + key signal chips at a glance.
 * Click navigates to /strike for the full detail view.
 */

const STATUS_CONFIG = {
  go:      { color: 'var(--c-go)',      label: 'GO',      bg: 'rgba(74,197,132,0.10)' },
  caution: { color: 'var(--c-warn)',    label: 'CAUTION', bg: 'rgba(251,191,36,0.10)' },
  blocked: { color: 'var(--c-stop)',    label: 'BLOCKED', bg: 'rgba(239,68,68,0.10)'  },
  unknown: { color: 'var(--c-text-dim)', label: '—',      bg: 'transparent'           },
}

const CHIP_COLORS = {
  // snowpack
  good:       'var(--c-go)',
  adequate:   'var(--c-warn)',
  // traffic
  low_traffic:'var(--c-go)',
  moderate:   'var(--c-warn)',
  high:       'var(--c-stop)',
  // permits
  available:  'var(--c-go)',
  full:       'var(--c-stop)',
  off_season: 'var(--c-text-dim)',
  // aqi / weather
  clear:      'var(--c-go)',
  caution:    'var(--c-warn)',
  blocked:    'var(--c-stop)',
  danger:     'var(--c-fire)',
  // fallback
  low:        'var(--c-stop)',
  unknown:    'var(--c-text-dim)',
}

function Chip({ label, value, numeric }) {
  const color   = CHIP_COLORS[value] ?? 'var(--c-text-dim)'
  const display = numeric ?? value?.replace(/_/g, ' ') ?? '—'

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      gap:            2,
      minWidth:       48,
    }}>
      <span style={{
        fontSize:      10,
        fontFamily:    'var(--c-font-mono)',
        color:         'var(--c-text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      <span style={{
        fontSize:      11,
        fontFamily:    'var(--c-font-mono)',
        color,
        textTransform: 'uppercase',
        fontWeight:    600,
        letterSpacing: '0.04em',
      }}>
        {display}
      </span>
    </div>
  )
}

export default function ZoneCard({ window: w, onClick }) {
  const status = STATUS_CONFIG[w.window_status] ?? STATUS_CONFIG.unknown
  const flags  = w.flags ?? {}

  const weatherActive = flags.weather && flags.weather !== 'clear'

  return (
    <div
      onClick={onClick}
      style={{
        background:   'var(--c-surface)',
        border:       `1px solid ${status.color}44`,
        borderLeft:   `3px solid ${status.color}`,
        borderRadius: 8,
        padding:      '14px 16px',
        cursor:       'pointer',
        display:      'flex',
        flexDirection:'column',
        gap:          12,
        transition:   'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--c-surface)'}
    >
      {/* Header row: score ring + zone name + weather badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flexShrink:     0,
          width:          44,
          height:         44,
          borderRadius:   '50%',
          border:         `2px solid ${status.color}`,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          background:     status.bg,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: status.color, lineHeight: 1 }}>
            {w.window_status === 'unknown' ? '?' : w.score}
          </span>
          <span style={{ fontSize: 8, color: status.color, fontFamily: 'var(--c-font-mono)', letterSpacing: '0.04em' }}>
            {status.label}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight:   600,
            fontSize:     13,
            color:        'var(--c-text)',
            lineHeight:   1.3,
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
          }}>
            {w.zone}
          </div>
          {weatherActive && (
            <div style={{
              marginTop:     3,
              display:       'inline-block',
              fontSize:      10,
              fontFamily:    'var(--c-font-mono)',
              color:         CHIP_COLORS[flags.weather] ?? 'var(--c-warn)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              ⚠ Weather {flags.weather}
            </div>
          )}
        </div>
      </div>

      {/* Signal chips row */}
      <div style={{
        display:         'flex',
        gap:             8,
        justifyContent:  'space-between',
        borderTop:       '1px solid var(--c-border)',
        paddingTop:      10,
      }}>
        <Chip
          label="AQI"
          value={flags.aqi ?? 'unknown'}
          numeric={w.aqi_value != null ? `${w.aqi_value}` : null}
        />
        <Chip
          label="Snow"
          value={flags.snowpack ?? 'unknown'}
          numeric={w.swe_pct != null ? `${w.swe_pct}%` : null}
        />
        <Chip
          label="Traffic"
          value={flags.traffic ?? 'unknown'}
        />
        <Chip
          label="Permits"
          value={flags.permits ?? 'unknown'}
        />
      </div>
    </div>
  )
}
