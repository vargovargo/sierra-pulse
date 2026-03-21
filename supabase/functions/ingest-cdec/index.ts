/**
 * ingest-cdec
 * Fetches snow water equivalent, snow depth, precipitation, and air temperature
 * from CDEC (CA Dept of Water Resources) CSV servlet for Sierra Nevada stations.
 *
 * Schedule: every 6 hours
 * Auth: none (public API)
 * Target table: stations (upsert), observations (insert ON CONFLICT DO NOTHING)
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { SENSOR_MAP, parseCdecCsv, buildCdecUrl, validateCdecRows, filterValidRows } from './parser.ts'

// Sierra Nevada CDEC snow course / snow sensor station IDs — ordered north to south
const SIERRA_STATIONS = [
  // Northern Sierra
  'GIN', 'TUM', 'DAN', 'LVL', 'VLC', 'SDF', 'HRS',
  // Yosemite / Mammoth region
  'MMD', 'HNT', 'SLK', 'WAL', 'BIS',
  // Eastern Sierra — Bishop zones
  'LON', 'GRZ', 'TRS',
  'BSH', 'RCK',  // Bishop Pass, Rock Creek Lakes (confirmed live)
  // Southern Sierra
  'BLY', 'MTP', 'COR', 'SRB', 'SWM',
  // Whitney / Kern
  'WBB', 'COT', 'OWL',
]

// Process stations in concurrent batches to stay within the 150s edge function timeout.
// 10 concurrent fetches × ~5s each ≈ 5s per batch; 25 stations ÷ 10 = 3 batches ≈ 15s total.
const BATCH_SIZE = 10

async function processStation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  stationId: string,
  sensorNums: string[],
  results: { stations_upserted: number; observations_inserted: number; errors: string[] }
): Promise<void> {
  try {
    const url = buildCdecUrl(stationId, sensorNums)
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const csv = await resp.text()

    const rows = parseCdecCsv(stationId, csv)
    if (rows.length === 0) return

    const warnings = validateCdecRows(rows)
    for (const w of warnings) {
      console.warn(`[cdec] ${w.message} (station ${w.stationId}, param ${w.parameter})`)
      results.errors.push(`WARN: ${w.message}`)
    }
    const validRows = filterValidRows(rows)
    if (validRows.length === 0) return

    const { error: stationErr } = await supabase
      .from('stations')
      .upsert(
        { source: 'cdec', source_id: stationId, name: stationId, type: 'snow' },
        { onConflict: 'source,source_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (stationErr && stationErr.code !== '23505') {
      results.errors.push(`Station upsert ${stationId}: ${stationErr.message}`)
      return
    }

    const { data: station } = await supabase
      .from('stations')
      .select('id')
      .eq('source', 'cdec')
      .eq('source_id', stationId)
      .single()

    if (!station) return

    const obsRows = validRows.map(r => ({
      station_id:  station.id,
      observed_at: r.observedAt,
      parameter:   r.parameter,
      value:       r.value,
      unit:        r.unit,
    }))

    const { data: inserted, error: obsErr } = await supabase
      .from('observations')
      .upsert(obsRows, { onConflict: 'station_id,parameter,observed_at', ignoreDuplicates: true })
      .select('id')

    if (obsErr) {
      results.errors.push(`Observations ${stationId}: ${obsErr.message}`)
    } else {
      results.observations_inserted += inserted?.length ?? 0
      results.stations_upserted++
    }
  } catch (err) {
    results.errors.push(`${stationId}: ${(err as Error).message}`)
  }
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const supabase   = getSupabaseAdmin()
  const results    = { stations_upserted: 0, observations_inserted: 0, errors: [] as string[] }
  const sensorNums = Object.keys(SENSOR_MAP)

  // Process in parallel batches to avoid timeout on 25+ stations
  for (let i = 0; i < SIERRA_STATIONS.length; i += BATCH_SIZE) {
    const batch = SIERRA_STATIONS.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(batch.map(stationId => processStation(supabase, stationId, sensorNums, results)))
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
