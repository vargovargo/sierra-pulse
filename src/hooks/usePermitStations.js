import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { TRAILHEADS } from '../lib/zones.js'

/**
 * Fetch trailhead permit availability for a zone, today → +6 months.
 * Only runs when zone is non-null (lazy — fires on card expand).
 *
 * Trailhead list comes from the hardcoded TRAILHEADS config (zones.js)
 * so this works even if permit stations haven't been ingested yet.
 *
 * Returns trailheads: [{
 *   name, trailhead_id,
 *   dates: [{ date, available, quota }]  -- sorted ascending, quota > 0 only
 * }]
 */
export function usePermitStations(zone) {
  const [trailheads, setTrailheads] = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!zone) return

    const zoneTrailheads = TRAILHEADS.filter(th => th.zone === zone)
    if (!zoneTrailheads.length) { setTrailheads([]); return }

    setLoading(true)
    setError(null)

    const divIds = zoneTrailheads.map(th => th.id)

    const today  = new Date().toISOString().split('T')[0]
    const sixMo  = new Date()
    sixMo.setMonth(sixMo.getMonth() + 6)
    const sixMoStr = sixMo.toISOString().split('T')[0]

    supabase
      .from('permits')
      .select('trailhead_id, date, available, quota')
      .in('trailhead_id', divIds)
      .gte('date', today)
      .lte('date', sixMoStr)
      .order('date', { ascending: true })
      .then(({ data: permits, error: permErr }) => {
        if (permErr) { setError(permErr); setLoading(false); return }

        const byDivId = {}
        for (const p of permits ?? []) {
          if (p.quota === 0) continue  // skip walkup/non-quota dates
          if (!byDivId[p.trailhead_id]) byDivId[p.trailhead_id] = []
          byDivId[p.trailhead_id].push({ date: p.date, available: p.available, quota: p.quota })
        }

        setTrailheads(zoneTrailheads.map(th => ({
          name:         th.name,
          trailhead_id: th.id,
          dates:        byDivId[th.id] ?? [],
        })))
        setLoading(false)
      })
  }, [zone])

  return { trailheads, loading, error }
}
