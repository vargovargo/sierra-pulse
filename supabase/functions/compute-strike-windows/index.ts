/**
 * compute-strike-windows
 * Combines snowpack, AQI, boot traffic, permit, and NWS weather alert signals
 * per zone into a strike window score. Upserts results into the strike_windows table.
 *
 * Schedule: every 2 hours — after aqi-ingest and strava-ingest have run.
 * Auth: none required (--no-verify-jwt)
 *
 * Scoring (0–100):
 *   AQI blocked (> 150)      → score = 0, status = 'blocked' (short-circuits)
 *   NWS danger alert active  → score = 0, status = 'blocked' (short-circuits)
 *   Snowpack   (0–40 pts): ≥ 80% p50 = 40 | 50–79% = 25 | < 50% = 10 | no data = 20
 *   Traffic    (0–30 pts): < 20 efforts = 30 | 20–50 = 15 | > 50 = 5 | no data = 15
 *   Permits    (0–30 pts): available = 30 | full = 0 | off-season = 20
 *   AQI caution (101–150)    → score capped at 60
 *   NWS caution alert active → score capped at 60
 *
 *   window_status: score ≥ 70 and aqi clear and no nws danger → 'go'
 *                  score < 40 or aqi blocked or nws danger    → 'blocked'
 *                  otherwise                                  → 'caution'
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin }        from '../_shared/supabaseAdmin.ts'
import { ZONE_CONFIGS }            from './zone_config.ts'

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

type AqiStatus = 'clear' | 'caution' | 'blocked'
type NwsStatus = 'clear' | 'caution' | 'danger'

function aqiStatus(value: number | null): AqiStatus {
  if (value === null) return 'clear'
  if (value <= 100)   return 'clear'
  if (value <= 150)   return 'caution'
  return 'blocked'
}

function snowpackScore(swePct: number | null): { score: number; label: string } {
  if (swePct === null) return { score: 20, label: 'unknown' }
  if (swePct >= 80)   return { score: 40, label: 'good' }
  if (swePct >= 50)   return { score: 25, label: 'adequate' }
  return { score: 10, label: 'low' }
}

function trafficScore(weeklyEfforts: number | null): { score: number; label: string } {
  if (weeklyEfforts === null) return { score: 15, label: 'unknown' }
  if (weeklyEfforts < 10)    return { score: 30, label: 'low' }
  if (weeklyEfforts <= 30)   return { score: 15, label: 'moderate' }
  return { score: 5, label: 'high' }
}

function permitScore(avail: boolean | null): { score: number; label: string } {
  if (avail === null) return { score: 20, label: 'off_season' }
  if (avail)          return { score: 30, label: 'available' }
  return { score: 0, label: 'full' }
}

function nwsStatusLabel(status: NwsStatus): string {
  if (status === 'danger')  return 'danger'
  if (status === 'caution') return 'caution'
  return 'clear'
}

function inBounds(
  lat: number, lon: number,
  [sw_lat, sw_lng, ne_lat, ne_lng]: [number, number, number, number]
): boolean {
  return lat >= sw_lat && lat <= ne_lat && lon >= sw_lng && lon <= ne_lng
}

function dayOfYear(): number {
  const la  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const jan1 = new Date(la.getFullYear(), 0, 1)
  return Math.ceil((la.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function todayLA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const supabase = getSupabaseAdmin()
  const errors: string[] = []

  // -------------------------------------------------------------------------
  // 1. AQI
  // -------------------------------------------------------------------------
  const { data: airnowStations, error: airnowStErr } = await supabase
    .from('stations')
    .select('id, source_id')
    .eq('source', 'airnow')

  if (airnowStErr) errors.push(`WARN: airnow stations: ${airnowStErr.message}`)

  const airnowIdToSourceId = new Map<string, string>(
    (airnowStations ?? []).map(s => [s.id, s.source_id])
  )

  const { data: aqiObs, error: aqiObsErr } = await supabase
    .from('station_latest_obs')
    .select('station_id, value')
    .in('station_id', [...airnowIdToSourceId.keys()])
    .eq('parameter', 'aqi')

  if (aqiObsErr) errors.push(`WARN: aqi obs: ${aqiObsErr.message}`)

  const aqiMap = new Map<string, number>()
  for (const obs of aqiObs ?? []) {
    const sourceId = airnowIdToSourceId.get(obs.station_id)
    if (sourceId !== undefined) aqiMap.set(sourceId, obs.value)
  }

  // -------------------------------------------------------------------------
  // 2. Snowpack
  // -------------------------------------------------------------------------
  const allCdecIds = [...new Set(ZONE_CONFIGS.flatMap(z => z.cdec_source_ids))]

  const { data: cdecStations, error: cdecStErr } = await supabase
    .from('stations')
    .select('id, source_id')
    .eq('source', 'cdec')
    .in('source_id', allCdecIds)

  if (cdecStErr) errors.push(`WARN: cdec stations: ${cdecStErr.message}`)

  const cdecSourceIdToId = new Map<string, string>(
    (cdecStations ?? []).map(s => [s.source_id, s.id])
  )
  const cdecIdToSourceId = new Map<string, string>(
    (cdecStations ?? []).map(s => [s.id, s.source_id])
  )

  const { data: sweObs, error: sweObsErr } = await supabase
    .from('station_latest_obs')
    .select('station_id, value')
    .in('station_id', [...cdecIdToSourceId.keys()])
    .eq('parameter', 'swe')

  if (sweObsErr) errors.push(`WARN: swe obs: ${sweObsErr.message}`)

  const sweMap = new Map<string, number>()
  for (const obs of sweObs ?? []) {
    const sourceId = cdecIdToSourceId.get(obs.station_id)
    if (sourceId !== undefined) sweMap.set(sourceId, obs.value)
  }

  const doy = dayOfYear()
  const { data: normals, error: normalsErr } = await supabase
    .from('historical_normals')
    .select('station_id, p50')
    .in('station_id', [...cdecIdToSourceId.keys()])
    .eq('parameter', 'swe')
    .eq('day_of_year', doy)

  if (normalsErr) errors.push(`WARN: historical normals: ${normalsErr.message}`)

  const p50Map = new Map<string, number>()
  for (const n of normals ?? []) {
    const sourceId = cdecIdToSourceId.get(n.station_id)
    if (sourceId !== undefined && n.p50 !== null) p50Map.set(sourceId, n.p50)
  }

  // -------------------------------------------------------------------------
  // 3. Boot traffic
  // -------------------------------------------------------------------------
  const { data: stravaStations, error: stravaStErr } = await supabase
    .from('stations')
    .select('id, lat, lon')
    .eq('type', 'trail_segment')

  if (stravaStErr) errors.push(`WARN: strava stations: ${stravaStErr.message}`)

  const stravaIds = (stravaStations ?? []).map(s => s.id)

  const { data: weeklyRows, error: weeklyErr } = await supabase
    .from('segment_weekly_efforts')
    .select('station_id, weekly_efforts')
    .in('station_id', stravaIds)

  if (weeklyErr) errors.push(`WARN: weekly efforts: ${weeklyErr.message}`)

  const weeklyMap = new Map<string, number>(
    (weeklyRows ?? []).map(r => [r.station_id, r.weekly_efforts])
  )

  interface StravaPoint { lat: number; lon: number; weekly_efforts: number }
  const stravaPoints: StravaPoint[] = []
  for (const s of stravaStations ?? []) {
    if (s.lat == null || s.lon == null) continue
    const cnt = weeklyMap.get(s.id)
    if (cnt === undefined) continue
    stravaPoints.push({ lat: s.lat, lon: s.lon, weekly_efforts: cnt })
  }

  // -------------------------------------------------------------------------
  // 4. Permits: availability in next 14 days
  // -------------------------------------------------------------------------
  const today = todayLA()
  const in14  = new Date(new Date(today).getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const allDivIds = [...new Set(ZONE_CONFIGS.flatMap(z => z.permit_div_ids))]

  const { data: allPermitRows, error: allPermitErr } = await supabase
    .from('permits')
    .select('trailhead_id')
    .in('trailhead_id', allDivIds)
    .gte('date', today)
    .lte('date', in14)

  if (allPermitErr) errors.push(`WARN: permits query: ${allPermitErr.message}`)

  const divsWithRecords = new Set<string>((allPermitRows ?? []).map(r => r.trailhead_id))

  const { data: availRows, error: availErr } = await supabase
    .from('permits')
    .select('trailhead_id')
    .in('trailhead_id', allDivIds)
    .gte('date', today)
    .lte('date', in14)
    .gt('available', 0)

  if (availErr) errors.push(`WARN: permits avail query: ${availErr.message}`)

  const divsWithAvail = new Set<string>((availRows ?? []).map(r => r.trailhead_id))

  // -------------------------------------------------------------------------
  // 5. NWS weather alerts (danger → block, caution → cap at 60)
  // All Bishop-area zones share the same NWS alert region — one query covers all.
  // -------------------------------------------------------------------------
  const now = new Date().toISOString()

  const { data: nwsDanger, error: nwsDangerErr } = await supabase
    .from('alerts')
    .select('id')
    .eq('source', 'nws')
    .eq('category', 'danger')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .limit(1)

  if (nwsDangerErr) errors.push(`WARN: nws danger query: ${nwsDangerErr.message}`)

  const { data: nwsCaution, error: nwsCautionErr } = await supabase
    .from('alerts')
    .select('id')
    .eq('source', 'nws')
    .eq('category', 'caution')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .limit(1)

  if (nwsCautionErr) errors.push(`WARN: nws caution query: ${nwsCautionErr.message}`)

  // Single NWS status applies to all Bishop-area zones (same region)
  const globalNwsStatus: NwsStatus =
    (nwsDanger?.length ?? 0) > 0 ? 'danger'
    : (nwsCaution?.length ?? 0) > 0 ? 'caution'
    : 'clear'

  // -------------------------------------------------------------------------
  // 6. Compute score per zone and upsert
  // -------------------------------------------------------------------------
  const upsertRows = []

  for (const zone of ZONE_CONFIGS) {
    try {
      // --- AQI ---
      const aqiVal   = aqiMap.get(zone.aqi_source_id) ?? null
      const aqi_stat = aqiStatus(aqiVal)

      // Hard blocks: AQI > 150 or active NWS danger alert
      if (aqi_stat === 'blocked' || globalNwsStatus === 'danger') {
        upsertRows.push({
          zone:          zone.name,
          score:         0,
          window_status: 'blocked',
          aqi_status:    aqi_stat,
          aqi_value:     aqiVal !== null ? Math.round(aqiVal) : null,
          swe_pct:       null,
          effort_count:  null,
          permits_avail: null,
          flags: {
            snowpack: 'unknown',
            traffic:  'unknown',
            permits:  'unknown',
            aqi:      aqi_stat,
            weather:  nwsStatusLabel(globalNwsStatus),
          },
          computed_at: new Date().toISOString(),
        })
        continue
      }

      // --- Snowpack ---
      let swe: number | undefined
      let p50: number | undefined
      for (const sid of zone.cdec_source_ids) {
        if (sweMap.has(sid)) {
          swe = sweMap.get(sid)
          p50 = p50Map.get(sid)
          break
        }
      }
      const swe_pct = (swe !== undefined && p50 !== undefined && p50 > 0)
        ? Math.round((swe / p50) * 100)
        : null
      const snow = snowpackScore(swe_pct)

      // --- Boot traffic ---
      const zoneEfforts = stravaPoints
        .filter(p => inBounds(p.lat, p.lon, zone.bounds))
        .reduce<number | null>((sum, p) => (sum === null ? p.weekly_efforts : sum + p.weekly_efforts), null)
      const traffic = trafficScore(zoneEfforts)

      // --- Permits ---
      const hasRecords    = zone.permit_div_ids.some(id => divsWithRecords.has(id))
      const hasAvail      = zone.permit_div_ids.some(id => divsWithAvail.has(id))
      const permits_avail = hasRecords ? hasAvail : null
      const perm          = permitScore(permits_avail)

      // --- Score ---
      let score = snow.score + traffic.score + perm.score
      if (aqi_stat === 'caution')        score = Math.min(score, 60)
      if (globalNwsStatus === 'caution') score = Math.min(score, 60)
      score = Math.min(100, Math.max(0, score))

      const window_status =
        score >= 70 && aqi_stat === 'clear' && globalNwsStatus !== 'danger' ? 'go'
        : score < 40                                                          ? 'blocked'
        :                                                                       'caution'

      upsertRows.push({
        zone:          zone.name,
        score,
        window_status,
        aqi_status:    aqi_stat,
        aqi_value:     aqiVal !== null ? Math.round(aqiVal) : null,
        swe_pct,
        effort_count:  zoneEfforts,
        permits_avail,
        flags: {
          snowpack: snow.label,
          traffic:  traffic.label,
          permits:  perm.label,
          aqi:      aqi_stat,
          weather:  nwsStatusLabel(globalNwsStatus),
        },
        computed_at: new Date().toISOString(),
      })
    } catch (err) {
      errors.push(`Zone "${zone.name}": ${(err as Error).message}`)
    }
  }

  let zones_computed = 0
  if (upsertRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('strike_windows')
      .upsert(upsertRows, { onConflict: 'zone', ignoreDuplicates: false })

    if (upsertErr) {
      errors.push(`Upsert error: ${upsertErr.message}`)
    } else {
      zones_computed = upsertRows.length
    }
  }

  return new Response(
    JSON.stringify({ zones_computed, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
