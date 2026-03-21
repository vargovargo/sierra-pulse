import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Fetches historical percentile bands for a station/parameter.
 * Returns all 365 rows (one per day-of-year) ordered chronologically.
 */
export function useHistoricalNormals(stationId, parameter) {
  const [normals, setNormals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!stationId || !parameter) {
      setLoading(false)
      return
    }

    supabase
      .from('historical_normals')
      .select('day_of_year, p10, p25, p50, p75, p90, record_min, record_max')
      .eq('station_id', stationId)
      .eq('parameter', parameter)
      .order('day_of_year', { ascending: true })
      .then(({ data, error }) => {
        setNormals(data ?? [])
        setError(error)
        setLoading(false)
      })
  }, [stationId, parameter])

  return { normals, loading, error }
}

/**
 * Fetches aggregated daily observations for the current calendar year,
 * returning { day_of_year, obs_date, value_avg } ordered chronologically.
 */
export function useDailyObservations(stationId, parameter) {
  const [daily, setDaily]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!stationId || !parameter) {
      setLoading(false)
      return
    }

    const yearStart = `${new Date().getFullYear()}-01-01`

    supabase
      .from('daily_observations')
      .select('day_of_year, obs_date, value_avg')
      .eq('station_id', stationId)
      .eq('parameter', parameter)
      .gte('obs_date', yearStart)
      .order('obs_date', { ascending: true })
      .then(({ data, error }) => {
        setDaily(data ?? [])
        setError(error)
        setLoading(false)
      })
  }, [stationId, parameter])

  return { daily, loading, error }
}
