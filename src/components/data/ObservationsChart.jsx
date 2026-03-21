import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useObservations } from '../../hooks/useObservations.js'
import { fmtValue, fmtDate } from '../../lib/formatters.js'
import LoadingSpinner from '../shared/LoadingSpinner.jsx'

const PARAM_COLORS = {
  swe:          'var(--c-snow)',
  snow_depth:   '#5A9AB8',
  discharge:    '#4A8AC8',
  gage_height:  '#6A7AC8',
  temp_air:     'var(--c-fire)',
}

export default function ObservationsChart({ stationId, parameter, unit, label }) {
  const { observations, loading } = useObservations(stationId, parameter, { limit: 96 })

  if (loading) return <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner /></div>

  if (!observations.length) {
    return (
      <div style={{
        height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-text-dim)', fontFamily: 'var(--c-font-mono)', fontSize: 12,
      }}>
        No observations yet
      </div>
    )
  }

  const color = PARAM_COLORS[parameter] ?? 'var(--c-snow)'
  const chartData = observations.map(o => ({
    t:     o.observed_at,
    value: o.value,
    unit:  o.unit,
  }))

  return (
    <div>
      <div style={{
        fontSize: 11,
        fontFamily: 'var(--c-font-mono)',
        color: 'var(--c-text-muted)',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label ?? parameter}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
          <XAxis
            dataKey="t"
            tickFormatter={v => {
              const d = new Date(v)
              return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`
            }}
            tick={{ fill: 'var(--c-text-dim)', fontSize: 10, fontFamily: 'var(--c-font-mono)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'var(--c-text-dim)', fontSize: 10, fontFamily: 'var(--c-font-mono)' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--c-surface-2)',
              border: '1px solid var(--c-border)',
              borderRadius: 4,
              fontFamily: 'var(--c-font-mono)',
              fontSize: 11,
              color: 'var(--c-text)',
            }}
            formatter={(value, _name, props) => [fmtValue(value, props.payload.unit), label ?? parameter]}
            labelFormatter={v => fmtDate(v)}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
