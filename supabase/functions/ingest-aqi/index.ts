/**
 * ingest-aqi
 * Fetches AQI / PM2.5 observations from AirNow (EPA) for key Sierra Nevada
 * monitoring areas and writes them to the observations table.
 *
 * Schedule: every 2 hours (smoke moves fast)
 * Auth: AIRNOW_API_KEY (free from airnowapi.org)
 * Target table: stations (upsert), observations (insert ON CONFLICT DO NOTHING)
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin }        from '../_shared/supabaseAdmin.ts'
import { parseAirNowResponse, validateAirNowRows, filterValidRows } from './mapper.ts'

// Key Sierra Nevada AQI monitoring locations
// AirNow query radius: 50 miles — returns nearest monitoring station data
const AIRNOW_STATIONS = [
  { source_id: 'BISHOP',    name: 'Bishop AQI',          lat: 37.363,  lon: -118.395, elevation_ft: 4147 },
  { source_id: 'MAMMOTH',   name: 'Mammoth Lakes AQI',   lat: 37.649,  lon: -118.972, elevation_ft: 7953 },
  { source_id: 'YOSEMITE',  name: 'Yosemite Valley AQI', lat: 37.748,  lon: -119.588, elevation_ft: 3966 },
]

function buildAirNowUrl(lat: number, lon: number, apiKey: string): string {
  const params = new URLSearchParams({
    latitude:  String(lat),
    longitude: String(lon),
    distance:  '50',
    format:    'application/json',
    API_KEY:   apiKey,
  })
  return `https://www.airnowapi.org/aq/observation/latLong/current/?${params}`
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const apiKey = Deno.env.get('AIRNOW_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AIRNOW_API_KEY not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseAdmin()
  const results = { stations_upserted: 0, observations_inserted: 0, errors: [] as string[] }

  for (const station of AIRNOW_STATIONS) {
    try {
      const url  = buildAirNowUrl(station.lat, station.lon, apiKey)
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status} from AirNow for ${station.source_id}`)

      const data = await resp.json()
      const rows = parseAirNowResponse(data)

      if (rows.length === 0) {
        console.warn(`[aqi] No observations returned for ${station.source_id}`)
        continue
      }

      const warnings = validateAirNowRows(rows)
      for (const w of warnings) {
        console.warn(`[aqi] ${w.message} (station ${station.source_id}, param ${w.parameter})`)
        results.errors.push(`WARN: ${w.message}`)
      }
      const validRows = filterValidRows(rows)
      if (validRows.length === 0) continue

      // Upsert station
      const { error: stationErr } = await supabase
        .from('stations')
        .upsert(
          {
            source:       'airnow',
            source_id:    station.source_id,
            name:         station.name,
            lat:          station.lat,
            lon:          station.lon,
            elevation_ft: station.elevation_ft,
            type:         'weather',
          },
          { onConflict: 'source,source_id', ignoreDuplicates: false }
        )

      if (stationErr && stationErr.code !== '23505') {
        results.errors.push(`Station upsert ${station.source_id}: ${stationErr.message}`)
        continue
      }

      // Fetch the station UUID
      const { data: stationRow } = await supabase
        .from('stations')
        .select('id')
        .eq('source', 'airnow')
        .eq('source_id', station.source_id)
        .single()

      if (!stationRow) continue

      // Deduplicate by (station_id, parameter, observed_at)
      const obsRows = validRows.map(r => ({
        station_id:  stationRow.id,
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
        results.errors.push(`Observations ${station.source_id}: ${obsErr.message}`)
      } else {
        results.observations_inserted += inserted?.length ?? 0
        results.stations_upserted++
      }
    } catch (err) {
      results.errors.push(`${station.source_id}: ${(err as Error).message}`)
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
