import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Fetch trailhead permit availability for a zone, today → +6 months.
 * Only runs when zone is non-null (lazy — fires on card expand).
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

    setLoading(true)
    setError(null)

    async function load() {
      const { data: stations, error: stErr } = await supabase
        .from('stations')
        .select('id, name, source_id')
        .eq('type', 'permit')
        .filter('metadata->>zone', 'eq', zone)

      if (stErr) { setError(stErr); setLoading(false); return }
      if (!stations?.length) { setTrailheads([]); setLoading(false); return }

      const divIds = stations.map(s => s.source_id.split('-').pop())

      const today   = new Date().toISOString().split('T')[0]
      const sixMo   = new Date()
      sixMo.setMonth(sixMo.getMonth() + 6)
      const sixMoStr = sixMo.toISOString().split('T')[0]

      const { data: permits, error: permErr } = await supabase
        .from('permits')
        .select('trailhead_id, date, available, quota')
        .in('trailhead_id', divIds)
        .gte('date', today)
        .lte('date', sixMoStr)
        .order('date', { ascending: true })

      if (permErr) { setError(permErr); setLoading(false); return }

      const byDivId = {}
      for (const p of permits ?? []) {
        if (p.quota === 0) continue  // skip walkup/non-quota dates
        if (!byDivId[p.trailhead_id]) byDivId[p.trailhead_id] = []
        byDivId[p.trailhead_id].push({ date: p.date, available: p.available, quota: p.quota })
      }

      setTrailheads(stations.map(s => {
        const divId = s.source_id.split('-').pop()
        return { name: s.name, trailhead_id: divId, dates: byDivId[divId] ?? [] }
      }))
      setLoading(false)
    }

    load()
  }, [zone])

  return { trailheads, loading, error }
}
