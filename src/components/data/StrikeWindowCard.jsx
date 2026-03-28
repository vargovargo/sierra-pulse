/**
 * StrikeWindowCard — displays strike window score and signal flags for one zone.
 * Click to expand inline trailhead panel with permit availability (~6 months out).
 *
 * window_status: 'go' | 'caution' | 'blocked' | 'unknown'
 */

import { useState, useMemo } from 'react'
import { usePermitStations } from '../../hooks/usePermitStations.js'

const STATUS_CONFIG = {
  go:      { color: 'var(--c-go)',   label: 'GO',      bg: 'rgba(74,197,132,0.10)' },
  caution: { color: 'var(--c-warn)', label: 'CAUTION', bg: 'rgba(251,191,36,0.10)' },
  blocked: { color: 'var(--c-stop)', label: 'BLOCKED', bg: 'rgba(239,68,68,0.10)'  },
  unknown: { color: 'var(--c-text-dim)', label: '—',   bg: 'transparent'           },
}

const AQI_COLORS = {
  clear:   'var(--c-go)',
  caution: 'var(--c-warn)',
  blocked: 'var(--c-stop)',
}

const FLAG_COLORS = {
  good:        'var(--c-go)',
  adequate:    'var(--c-warn)',
  low:         'var(--c-stop)',
  available:   'var(--c-go)',
  full:        'var(--c-stop)',
  off_season:  'var(--c-text-dim)',
  low_traffic: 'var(--c-go)',
  moderate:    'var(--c-warn)',
  high:        'var(--c-stop)',
  clear:       'var(--c-go)',
  caution:     'var(--c-warn)',
  danger:      'var(--c-stop)',
  unknown:     'var(--c-text-dim)',
}

function FlagPill({ label, value }) {
  const color   = FLAG_COLORS[value] ?? 'var(--c-text-dim)'
  const display = value?.replace(/_/g, ' ') ?? '—'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-dim)', minWidth: 70 }}>{label}</span>
      <span style={{
        fontSize:      11,
        fontFamily:    'var(--c-font-mono)',
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {display}
      </span>
    </div>
  )
}

function fmtMonthLabel(ym) {
  const [y, m] = ym.split('-')
  return new Date(+y, +m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

function TrailheadPanel({ zone }) {
  const { trailheads, loading, error } = usePermitStations(zone)
  const [activeMonth, setActiveMonth] = useState(null)

  // Collect all months that have data across all trailheads
  const allMonths = useMemo(() => {
    const months = new Set()
    for (const t of trailheads) {
      for (const d of t.dates) months.add(d.date.slice(0, 7))
    }
    return Array.from(months).sort()
  }, [trailheads])

  const currentMonth = activeMonth ?? allMonths[0] ?? null

  if (loading) {
    return (
      <div style={{ padding: '12px 0 4px', color: 'var(--c-text-dim)', fontSize: 12 }}>
        Loading trailheads…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '12px 0 4px', color: 'var(--c-stop)', fontSize: 12 }}>
        Could not load permit data.
      </div>
    )
  }

  if (!trailheads.length) {
    return (
      <div style={{ padding: '12px 0 4px', color: 'var(--c-text-dim)', fontSize: 12 }}>
        No trailheads configured for this zone.
      </div>
    )
  }

  // If no quota dates at all, show off-season message
  if (allMonths.length === 0) {
    return (
      <div style={{
        marginTop:  12,
        paddingTop: 12,
        borderTop:  '1px solid var(--c-border)',
        fontSize:   12,
        color:      'var(--c-text-dim)',
      }}>
        Season opens ~May 1 — no quota dates available yet.
      </div>
    )
  }

  return (
    <div style={{
      marginTop:  12,
      paddingTop: 12,
      borderTop:  '1px solid var(--c-border)',
    }}>
      {/* Month tabs */}
      <div
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}
        onClick={e => e.stopPropagation()}
      >
        {allMonths.map(ym => {
          const active = ym === currentMonth
          return (
            <button
              key={ym}
              onClick={e => { e.stopPropagation(); setActiveMonth(ym) }}
              style={{
                padding:       '3px 10px',
                borderRadius:  4,
                border:        `1px solid ${active ? 'var(--c-border)' : 'transparent'}`,
                background:    active ? 'var(--c-surface-2)' : 'transparent',
                color:         active ? 'var(--c-text)' : 'var(--c-text-dim)',
                fontSize:      11,
                fontFamily:    'var(--c-font-mono)',
                cursor:        'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {fmtMonthLabel(ym)}
            </button>
          )
        })}
      </div>

      {/* Per-trailhead date grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {trailheads.map(t => {
          const monthDates = t.dates.filter(d => d.date.startsWith(currentMonth ?? ''))
          return (
            <div key={t.trailhead_id}>
              <div style={{
                fontSize:      11,
                fontFamily:    'var(--c-font-mono)',
                color:         'var(--c-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom:  6,
              }}>
                {t.name}
              </div>

              {monthDates.length === 0 ? (
                <span style={{ fontSize: 11, color: 'var(--c-text-dim)' }}>
                  No quota dates this month
                </span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {monthDates.map(d => {
                    const day   = +d.date.slice(8)
                    const avail = d.available > 0
                    const dow   = new Date(d.date + 'T12:00:00').toLocaleString('en-US', { weekday: 'short' })
                    return (
                      <div
                        key={d.date}
                        title={`${d.date}: ${d.available} of ${d.quota} available`}
                        onClick={e => { e.stopPropagation(); window.open('https://www.recreation.gov/permits/233262', '_blank') }}
                        style={{
                          cursor: 'pointer',
                          width:      38,
                          padding:    '5px 2px 4px',
                          borderRadius: 4,
                          background: avail ? 'rgba(74,197,132,0.10)' : 'rgba(239,68,68,0.07)',
                          border:     `1px solid ${avail ? 'rgba(74,197,132,0.30)' : 'rgba(239,68,68,0.25)'}`,
                          textAlign:  'center',
                          fontSize:   10,
                          fontFamily: 'var(--c-font-mono)',
                          lineHeight: 1.3,
                        }}
                      >
                        <div style={{ color: 'var(--c-text-dim)', fontSize: 9 }}>{dow}</div>
                        <div style={{ color: 'var(--c-text-dim)' }}>{day}</div>
                        <div style={{
                          color:      avail ? 'var(--c-go)' : 'var(--c-stop)',
                          fontWeight: 600,
                          fontSize:   11,
                        }}>
                          {avail ? (d.available > 99 ? '99+' : d.available) : '✕'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StrikeWindowCard({ window: w }) {
  const [expanded, setExpanded] = useState(false)

  const status      = STATUS_CONFIG[w.window_status] ?? STATUS_CONFIG.unknown
  const flags       = w.flags ?? {}
  const computedLabel = w.computed_at
    ? new Date(w.computed_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZoneName: 'short',
      })
    : null

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background:    'var(--c-surface)',
        border:        `1px solid ${status.color}44`,
        borderLeft:    `3px solid ${status.color}`,
        borderRadius:  8,
        padding:       '16px 20px',
        display:       'flex',
        flexDirection: 'column',
        cursor:        'pointer',
        userSelect:    'none',
      }}
    >
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Score ring */}
        <div style={{
          flexShrink:     0,
          width:          56,
          height:         56,
          borderRadius:   '50%',
          border:         `3px solid ${status.color}`,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          background:     status.bg,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: status.color, lineHeight: 1 }}>
            {w.window_status === 'unknown' ? '?' : w.score}
          </span>
          <span style={{ fontSize: 9, color: status.color, fontFamily: 'var(--c-font-mono)', letterSpacing: '0.04em' }}>
            {status.label}
          </span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{w.zone}</div>
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', marginLeft: 8 }}>
              {expanded ? '▲' : '▼'}
            </span>
          </div>
          {computedLabel && (
            <div style={{ fontSize: 11, color: 'var(--c-text-dim)', marginBottom: 10 }}>
              Updated {computedLabel}
            </div>
          )}

          {/* Signal flags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FlagPill label="AQI" value={flags.aqi ?? 'unknown'} />
            {w.aqi_value != null && (
              <div style={{ marginTop: -2, marginLeft: 76 }}>
                <span style={{ fontSize: 11, color: AQI_COLORS[flags.aqi] ?? 'var(--c-text-muted)' }}>
                  {w.aqi_value} AQI
                </span>
              </div>
            )}
            <FlagPill label="Weather" value={flags.weather ?? 'clear'} />
            <FlagPill label="Snowpack" value={flags.snowpack} />
            {w.swe_pct != null && (
              <div style={{ marginTop: -2, marginLeft: 76 }}>
                <span style={{ fontSize: 11, color: 'var(--c-text-dim)' }}>{w.swe_pct}% of median</span>
              </div>
            )}
            <FlagPill label="Traffic" value={flags.traffic} />
            {w.effort_count != null && (
              <div style={{ marginTop: -2, marginLeft: 76 }}>
                <span style={{ fontSize: 11, color: 'var(--c-text-dim)' }}>{w.effort_count.toLocaleString()} this week</span>
              </div>
            )}
            <FlagPill label="Permits" value={flags.permits} />
          </div>
        </div>
      </div>

      {/* Trailhead detail panel — lazy loaded on expand */}
      {expanded && <TrailheadPanel zone={w.zone} />}
    </div>
  )
}
