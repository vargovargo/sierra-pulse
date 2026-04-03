import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import HistoricalEnvelopeChart from '../components/data/HistoricalEnvelopeChart.jsx'
import StationsTable from '../components/data/StationsTable.jsx'
import ErrorBoundary from '../components/shared/ErrorBoundary.jsx'
import LoadingSpinner from '../components/shared/LoadingSpinner.jsx'
import { useHistoricalNormals, useDailyObservations } from '../hooks/useHistoricalNormals.js'

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

const PARAM_CONFIG = {
  swe:       { unit: 'inches', color: 'var(--c-snow)',  doyRange: [1, 210] },
  discharge: { unit: 'cfs',    color: 'var(--c-go)',    doyRange: [1, 300] },
}

function EnvelopeSection({ station, parameter }) {
  const navigate = useNavigate()
  const cfg = PARAM_CONFIG[parameter] ?? { unit: '', color: 'var(--c-snow)', doyRange: [1, 365] }
  const { normals, loading: nLoading } = useHistoricalNormals(station.id, parameter)
  const { daily,   loading: dLoading } = useDailyObservations(station.id, parameter)

  return (
    <div style={{
      background:   'var(--c-surface)',
      border:       '1px solid var(--c-border)',
      borderRadius: 8,
      padding:      '16px 20px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--c-text-dim)', fontFamily: 'var(--c-font-mono)' }}>
          {station.source.toUpperCase()} · {station.source_id}
          {station.elevation_ft ? ` · ${station.elevation_ft.toLocaleString()} ft` : ''}
        </span>
        {station.lat && station.lon && (
          <button
            onClick={() => navigate(`/map?lat=${station.lat}&lng=${station.lon}&zoom=12`)}
            style={{
              background:  'none',
              border:      '1px solid var(--c-border)',
              borderRadius: 5,
              color:       'var(--c-text-dim)',
              fontSize:    11,
              fontFamily:  'var(--c-font-mono)',
              padding:     '2px 8px',
              cursor:      'pointer',
            }}
            title="View on map"
          >
            ↗ map
          </button>
        )}
      </div>
      <ErrorBoundary>
        <HistoricalEnvelopeChart
          normals={normals}
          current={daily}
          label={`${station.name} — ${parameter.toUpperCase()}`}
          unit={cfg.unit}
          color={cfg.color}
          loading={nLoading || dLoading}
          doyRange={cfg.doyRange}
        />
      </ErrorBoundary>
    </div>
  )
}

export default function HistoryPage() {
  const [entries, setEntries] = useState([])  // [{ station, parameter }]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Fetch one row per (station_id, parameter) pair by filtering day_of_year = 1.
      // Avoids pulling all 365 rows per pair, which would exceed the PostgREST row cap.
      const { data: normalRows } = await supabase
        .from('historical_normals')
        .select('station_id, parameter')
        .eq('day_of_year', 1)
        .order('station_id')

      if (!normalRows?.length) { setLoading(false); return }

      const pairs = normalRows

      const stationIds = [...new Set(pairs.map(p => p.station_id))]

      const { data: stations } = await supabase
        .from('stations')
        .select('id, name, source, source_id, lat, lon, elevation_ft')
        .in('id', stationIds)

      const stMap = {}
      for (const s of stations ?? []) stMap[s.id] = s

      setEntries(pairs.map(p => ({ station: stMap[p.station_id], parameter: p.parameter }))
        .filter(e => e.station))
      setLoading(false)
    }
    load()
  }, [])

  const swe       = entries.filter(e => e.parameter === 'swe')
  const discharge = entries.filter(e => e.parameter === 'discharge')

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
        Water &amp; Snow
      </h1>
      <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginBottom: 8 }}>
        Current conditions and historical context (1991–2020 climatology).
      </p>

      {/* Current streamflow + snowpack */}
      <div data-tour="history-content">
        <SectionTitle>Streamflow — Current Conditions</SectionTitle>
        <ErrorBoundary>
          <StationsTable source="usgs" type="streamflow" />
        </ErrorBoundary>

        {/* Current snowpack */}
        <SectionTitle>Snowpack — Current Conditions</SectionTitle>
        <ErrorBoundary>
          <StationsTable source="cdec" type="snow" />
        </ErrorBoundary>
      </div>

      {/* Historical envelope charts */}
      {loading && <LoadingSpinner />}

      {!loading && swe.length > 0 && (
        <>
          <SectionTitle>Snow Water Equivalent — Historical Context</SectionTitle>
          <p style={{ color: 'var(--c-text-dim)', fontSize: 12, marginBottom: 16 }}>
            Current water year vs. 30-year median. Bands = p10/p25–p75/p90.
          </p>
          {swe.map(({ station, parameter }) => (
            <EnvelopeSection key={`${station.id}:${parameter}`} station={station} parameter={parameter} />
          ))}
        </>
      )}

      {!loading && discharge.length > 0 && (
        <>
          <SectionTitle>Streamflow — Historical Context</SectionTitle>
          <p style={{ color: 'var(--c-text-dim)', fontSize: 12, marginBottom: 16 }}>
            Current water year vs. 30-year median. Bands = p10/p25–p75/p90.
          </p>
          {discharge.map(({ station, parameter }) => (
            <EnvelopeSection key={`${station.id}:${parameter}`} station={station} parameter={parameter} />
          ))}
        </>
      )}
    </div>
  )
}
