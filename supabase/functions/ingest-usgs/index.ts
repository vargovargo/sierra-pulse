/**
 * ingest-usgs
 * Fetches streamflow (discharge) and gage height from USGS Water Services
 * for Sierra Nevada stream gauges.
 *
 * Schedule: every 6 hours
 * Auth: none (public API)
 * Target table: stations (upsert), observations (insert ON CONFLICT DO NOTHING)
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { buildUsgsUrl, parseUsgsResponse, validateUsgsRows, filterValidRows } from './parser.ts'

// Sierra Nevada USGS stream gauge site IDs
const SIERRA_GAUGES = [
  // Merced / Yosemite
  '11264500', // Merced R at Happy Isles, Yosemite
  '11270900', // Merced R below Pohono Bridge
  '11303000', // Merced R at Shaffer Bridge
  // San Joaquin drainage
  '11230500', // San Joaquin R at Friant
  '11224500', // Kings R near Piedra
  '11335000', // Cosumnes R at Michigan Bar
  // Tuolumne
  '11276500', // Tuolumne R at Hetch Hetchy
  // Kern
  '11186000', // Kern R near Kernville
  // Eastern Sierra
  '10336660', // Truckee R at Tahoe City
  '10339400', // Truckee R at Reno
]

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const supabase = getSupabaseAdmin()
  const results = { stations_upserted: 0, observations_inserted: 0, errors: [] as string[] }

  try {
    const url = buildUsgsUrl(SIERRA_GAUGES)
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!resp.ok) throw new Error(`USGS HTTP ${resp.status}`)
    const json = await resp.json()
    const rows = parseUsgsResponse(json)

    // Validate data quality
    const warnings = validateUsgsRows(rows)
    for (const w of warnings) {
      console.warn(`[usgs] ${w.message} (gauge ${w.source_id}, param ${w.parameter})`)
      results.errors.push(`WARN: ${w.message}`)
    }
    const validRows = filterValidRows(rows)

    // Group by site to upsert each station once
    const bySite = new Map<string, typeof validRows>()
    for (const row of validRows) {
      if (!bySite.has(row.source_id)) bySite.set(row.source_id, [])
      bySite.get(row.source_id)!.push(row)
    }

    for (const [sourceId, siteRows] of bySite) {
      const first = siteRows[0]

      await supabase.from('stations').upsert(
        {
          source:    'usgs',
          source_id: sourceId,
          name:      first.name,
          lat:       first.lat,
          lon:       first.lon,
          type:      'streamflow',
        },
        { onConflict: 'source,source_id', ignoreDuplicates: false }
      )

      const { data: station } = await supabase
        .from('stations')
        .select('id')
        .eq('source', 'usgs')
        .eq('source_id', sourceId)
        .single()

      if (!station) continue

      const obsRows = siteRows.map(r => ({
        station_id:  station.id,
        observed_at: r.observed_at,
        parameter:   r.parameter,
        value:       r.value,
        unit:        r.unit,
      }))

      const { data: inserted, error: obsErr } = await supabase
        .from('observations')
        .upsert(obsRows, { onConflict: 'station_id,parameter,observed_at', ignoreDuplicates: true })
        .select('id')

      if (obsErr) {
        results.errors.push(`${sourceId}: ${obsErr.message}`)
      } else {
        results.observations_inserted += inserted?.length ?? 0
        results.stations_upserted++
      }
    }
  } catch (err) {
    results.errors.push((err as Error).message)
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
