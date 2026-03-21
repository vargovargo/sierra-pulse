import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Fetch trailhead permit availability for a zone, 6 months out.
 * Only runs when zone is non-null (lazy — fires on card expand).
 *
 * Returns trailheads: [{ name, trailhead_id, datesAvailable, totalDates, targetMonth }]
 */
export function usePermitStations(zone) {
  const [trailheads, setTrailheads] = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!zone) return

    setLoading(true)
    setError(null)

    async function fetch() {
      // 1. Get permit stations for this zone via metadata.zone
      const { data: stations, error: stErr } = await supabase
        .from('stations')
        .select('id, name, source_id')
        .eq('type', 'permit')
        .filter('metadata->>zone', 'eq', zone)

      if (stErr) { setError(stErr); setLoading(false); return }
      if (!stations?.length) { setTrailheads([]); setLoading(false); return }

      // 2. Extract division IDs from source_ids (format: "233262-{div_id}")
      const divIds = stations.map(s => s.source_id.split('-').pop())

      // 3. Compute target month: first day of month 6 months from today
      const target = new Date()
      target.setDate(1)
      target.setMonth(target.getMonth() + 6)
      const targetStart = target.toISOString().split('T')[0]           // YYYY-MM-01
      const targetEnd   = new Date(target.getFullYear(), target.getMonth() + 1, 0)
        .toISOString().split('T')[0]                                   // last day of month
      const targetMonth = target.toLocaleString('en-US', { month: 'long', year: 'numeric' })

      // 4. Fetch permit availability for target month
      const { data: permits, error: permErr } = await supabase
        .from('permits')
        .select('trailhead_id, date, available, quota')
        .in('trailhead_id', divIds)
        .gte('date', targetStart)
        .lte('date', targetEnd)

      if (permErr) { setError(permErr); setLoading(false); return }

      // 5. Merge stations with permit rows
      const permitsByDivId = {}
      for (const p of permits ?? []) {
        if (!permitsByDivId[p.trailhead_id]) permitsByDivId[p.trailhead_id] = []
        permitsByDivId[p.trailhead_id].push(p)
      }

      const merged = stations.map(s => {
        const divId = s.source_id.split('-').pop()
        const rows  = permitsByDivId[divId] ?? []
        return {
          name:           s.name,
          trailhead_id:   divId,
          datesAvailable: rows.filter(r => r.available > 0).length,
          totalDates:     rows.length,
          targetMonth,
        }
      })

      setTrailheads(merged)
      setLoading(false)
    }

    fetch()
  }, [zone])

  return { trailheads, loading, error }
}
