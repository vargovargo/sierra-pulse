import { useStations } from '../../hooks/useStations.js'
import { useLatestObservations } from '../../hooks/useObservations.js'
import { fmtValue, fmtElevation, fmtRelativeTime } from '../../lib/formatters.js'
import LoadingSpinner from '../shared/LoadingSpinner.jsx'
import Badge from '../shared/Badge.jsx'

const PARAM_BY_TYPE = {
  snow:       ['swe', 'snow_depth'],
  streamflow: ['discharge', 'gage_height'],
}

const PARAM_LABELS = {
  swe:         'SWE',
  snow_depth:  'Depth',
  discharge:   'Discharge',
  gage_height: 'Gage Ht',
}

export default function StationsTable({ source, type }) {
  const { stations, loading: stLoading } = useStations({ source, type })
  const stationIds = stations.map(s => s.id)
  const params     = PARAM_BY_TYPE[type] ?? ['swe', 'discharge']
  const { latest, loading: obsLoading } = useLatestObservations(stationIds, params)

  if (stLoading) return <LoadingSpinner />

  if (!stations.length) {
    return (
      <p style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--c-font-mono)', fontSize: 12 }}>
        No {source} stations found. Run the ingest function to populate data.
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--c-font-mono)',
        fontSize: 12,
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--c-border)' }}>
            <Th>Station</Th>
            <Th>Elev</Th>
            {params.map(p => <Th key={p}>{PARAM_LABELS[p] ?? p}</Th>)}
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {stations.map(station => {
            const obs = latest[station.id] ?? {}
            const firstObs = obs[params[0]]
            return (
              <tr key={station.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge category={type} label={source?.toUpperCase()} />
                    <span style={{ color: 'var(--c-text)' }}>{station.name}</span>
                  </div>
                </Td>
                <Td muted>{fmtElevation(station.elevation_ft)}</Td>
                {params.map(p => (
                  <Td key={p}>
                    {obsLoading ? <LoadingSpinner size={12} /> : fmtValue(obs[p]?.value, obs[p]?.unit)}
                  </Td>
                ))}
                <Td muted>{obsLoading ? '…' : fmtRelativeTime(firstObs?.observed_at)}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }) {
  return (
    <th style={{
      textAlign: 'left',
      padding: '8px 12px',
      color: 'var(--c-text-dim)',
      fontWeight: 500,
      textTransform: 'uppercase',
      fontSize: 10,
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

function Td({ children, muted }) {
  return (
    <td style={{
      padding: '8px 12px',
      color: muted ? 'var(--c-text-muted)' : 'var(--c-text)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </td>
  )
}
