import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useObservations(stationId, parameter, { limit = 48 } = {}) {
  const [observations, setObservations] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  useEffect(() => {
    if (!stationId || !parameter) {
      setLoading(false)
      return
    }

    supabase
      .from('observations')
      .select('*')
      .eq('station_id', stationId)
      .eq('parameter', parameter)
      .order('observed_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        setObservations((data ?? []).reverse()) // chronological for charts
        setError(error)
        setLoading(false)
      })
  }, [stationId, parameter, limit])

  return { observations, loading, error }
}

/**
 * Fetches the most recent observation for each station in a list.
 * Returns a map of { [station_id]: { [parameter]: { value, unit, observed_at } } }
 */
export function useLatestObservations(stationIds, parameters) {
  const [latest, setLatest]   = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!stationIds?.length || !parameters?.length) {
      setLoading(false)
      return
    }

    // station_latest_obs view returns one row per (station_id, parameter) — no client-side reduction needed
    supabase
      .from('station_latest_obs')
      .select('station_id, parameter, value, unit, observed_at')
      .in('station_id', stationIds)
      .in('parameter', parameters)
      .then(({ data }) => {
        const map = {}
        for (const row of data ?? []) {
          if (!map[row.station_id]) map[row.station_id] = {}
          map[row.station_id][row.parameter] = {
            value:       row.value,
            unit:        row.unit,
            observed_at: row.observed_at,
          }
        }
        setLatest(map)
        setLoading(false)
      })
  }, [JSON.stringify(stationIds), JSON.stringify(parameters)])

  return { latest, loading }
}
