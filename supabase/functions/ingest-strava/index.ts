/**
 * ingest-strava
 * Discovers Strava hiking/running segments in Eastern Sierra trailhead zones,
 * then records cumulative effort_count as a daily observation.
 *
 * Strike window signal: daily delta between consecutive effort_count observations
 * measures boot traffic. Computed by the strike window engine, not here.
 *
 * Schedule: daily (0 6 * * *)
 * Auth: Strava OAuth (STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN)
 * Target table: stations (source='strava'), observations (parameter='effort_count')
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin }        from '../_shared/supabaseAdmin.ts'
import { refreshAccessToken, exploreSegments, fetchSegment } from './client.ts'
import { ZONES } from './zones.ts'

// Strava rate limit: 100 req/15min, 1000/day.
// Budget: 12 explore requests + up to MAX_DETAIL_FETCHES detail requests.
// Stations are upserted from explore data (no extra request per station).
// Detail fetch is only needed for effort_count — capped and sorted by distance
// so the longest (most significant) trail segments are always tracked.
const MAX_DETAIL_FETCHES = 80
const DETAIL_FETCH_DELAY_MS = 150

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const results = {
    segments_discovered:   0,
    stations_upserted:     0,
    observations_inserted: 0,
    errors: [] as string[],
  }

  // --- Auth ---
  const clientId     = Deno.env.get('STRAVA_CLIENT_ID')
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
  const refreshToken = Deno.env.get('STRAVA_REFRESH_TOKEN')

  if (!clientId || !clientSecret || !refreshToken) {
    return new Response(
      JSON.stringify({ error: 'Missing Strava credentials' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let accessToken: string
  try {
    const tokenResp = await refreshAccessToken(clientId, clientSecret, refreshToken)
    accessToken = tokenResp.access_token
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Token refresh: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseAdmin()

  // --- Discover segments across all zones ---
  // Collect unique segments from all zone explore calls. Explore data includes
  // name + lat/lon, so we can upsert stations immediately without a detail fetch.
  const seenIds  = new Set<number>()
  const allSegs: Array<{ id: number; name: string; lat: number; lon: number; distance: number }> = []

  for (const zone of ZONES) {
    try {
      const segments = await exploreSegments(accessToken, zone.bounds, 'running')
      for (const seg of segments) {
        if (seenIds.has(seg.id)) continue
        seenIds.add(seg.id)
        allSegs.push({
          id:       seg.id,
          name:     seg.name,
          lat:      seg.start_latlng[0],
          lon:      seg.start_latlng[1],
          distance: seg.distance,
        })
      }
    } catch (err) {
      results.errors.push(`WARN: explore "${zone.name}": ${(err as Error).message}`)
    }
  }

  results.segments_discovered = allSegs.length

  // --- Upsert all stations from explore data (no extra API calls) ---
  if (allSegs.length > 0) {
    const stationRows = allSegs.map(s => ({
      source:    'strava',
      source_id: String(s.id),
      name:      s.name,
      type:      'trail_segment',
      lat:       s.lat,
      lon:       s.lon,
    }))
    const { error: bulkErr } = await supabase
      .from('stations')
      .upsert(stationRows, { onConflict: 'source,source_id', ignoreDuplicates: false })
    if (bulkErr) results.errors.push(`Station bulk upsert: ${bulkErr.message}`)
    else results.stations_upserted = allSegs.length
  }

  // --- Fetch effort_count for top segments by distance ---
  // Sort longest first — longer segments = more significant trails.
  // Cap at MAX_DETAIL_FETCHES to stay within Strava's 100 req/15min limit.
  const toFetch = [...allSegs]
    .sort((a, b) => b.distance - a.distance)
    .slice(0, MAX_DETAIL_FETCHES)

  const observedAt = new Date().toISOString()

  for (const seg of toFetch) {
    try {
      await sleep(DETAIL_FETCH_DELAY_MS)
      const detail = await fetchSegment(accessToken, seg.id)

      const { data: station } = await supabase
        .from('stations')
        .select('id')
        .eq('source', 'strava')
        .eq('source_id', String(seg.id))
        .single()

      if (!station) continue

      const { data: inserted, error: obsErr } = await supabase
        .from('observations')
        .upsert(
          [{
            station_id:  station.id,
            observed_at: observedAt,
            parameter:   'effort_count',
            value:       detail.effort_count,
            unit:        'efforts',
          }],
          { onConflict: 'station_id,parameter,observed_at', ignoreDuplicates: true }
        )
        .select('id')

      if (obsErr) {
        results.errors.push(`Obs ${seg.id}: ${obsErr.message}`)
      } else {
        results.observations_inserted += inserted?.length ?? 0
      }
    } catch (err) {
      results.errors.push(`WARN: segment ${seg.id}: ${(err as Error).message}`)
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
