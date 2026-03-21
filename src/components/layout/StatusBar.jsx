import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { fmtRelativeTime } from '../../lib/formatters.js'

const SOURCE_LABELS = {
  cdec: 'CDEC',
  usgs: 'USGS',
}

function freshnessColor(isoString) {
  if (!isoString) return 'var(--c-text-dim)'
  const hr = (Date.now() - new Date(isoString).getTime()) / 3_600_000
  if (hr < 1)  return 'var(--c-go)'
  if (hr < 8)  return 'var(--c-warn)'
  return 'var(--c-stop)'
}

export default function StatusBar() {
  const [status, setStatus] = useState({})

  useEffect(() => {
    async function fetchStatus() {
      // Latest observation created_at per source type
      const { data } = await supabase
        .from('observations')
        .select('created_at, stations!inner(source)')
        .order('created_at', { ascending: false })
        .limit(200)

      const latest = {}
      for (const row of data ?? []) {
        const src = row.stations?.source
        if (src && !latest[src]) latest[src] = row.created_at
      }

      // Latest alert for NPS
      const { data: alertData } = await supabase
        .from('alerts')
        .select('created_at')
        .eq('source', 'nps')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (alertData) latest.nps = alertData.created_at

      setStatus(latest)
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const entries = [
    { key: 'cdec', label: 'CDEC snow' },
    { key: 'usgs', label: 'USGS flow' },
    { key: 'nps',  label: 'NPS alerts' },
  ]

  return (
    <div style={{
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap',
      padding: '8px 12px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 6,
      marginBottom: 24,
      fontSize: 12,
      fontFamily: 'var(--c-font-mono)',
    }}>
      {entries.map(({ key, label }) => (
        <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: freshnessColor(status[key]),
            flexShrink: 0,
          }} />
          <span style={{ color: 'var(--c-text-muted)' }}>{label}:</span>
          <span style={{ color: 'var(--c-text)' }}>{fmtRelativeTime(status[key])}</span>
        </span>
      ))}
    </div>
  )
}
