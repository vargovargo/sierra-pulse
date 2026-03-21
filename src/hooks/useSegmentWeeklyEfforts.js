import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Returns weekly effort deltas and season opener dates for all trail segments.
 * Keyed by station_id for O(1) lookup in map popups.
 *
 * Shape: { [station_id]: { weekly_efforts, last_seen, season_opener } }
 */
export function useSegmentWeeklyEfforts(stationIds = []) {
  const [efforts, setEfforts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!stationIds.length) { setLoading(false); return }

    supabase
      .from('segment_weekly_efforts')
      .select('station_id, weekly_efforts, last_seen, season_opener, last_active, season_closer')
      .in('station_id', stationIds)
      .then(({ data }) => {
        const map = {}
        for (const row of data ?? []) map[row.station_id] = row
        setEfforts(map)
        setLoading(false)
      })
  }, [stationIds.join(',')])

  return { efforts, loading }
}
