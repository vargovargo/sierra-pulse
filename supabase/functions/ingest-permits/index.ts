/**
 * ingest-permits
 * Fetches overnight wilderness permit availability from Recreation.gov
 * for Eastern Sierra (Bishop area) trailhead entry points.
 *
 * Writes rows to the `permits` table (trailhead / date / available / quota).
 * compute-strike-windows reads permits WHERE date in next 14 days.
 * Frontend reads permits WHERE date in the 6-month planning target window.
 *
 * Fetches two months per run:
 *   - Current month  (for strike window engine: is there any availability soon?)
 *   - +6 months out  (for trailhead detail panel: planning window availability)
 *
 * Schedule: every 2 hours (0 *\/2 * * *)
 * Auth: RIDB_API_KEY
 * Target table: stations (source='recgov', metadata.zone set), permits
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin }        from '../_shared/supabaseAdmin.ts'
import { INYO_FACILITY_ID, DIVISIONS } from './divisions.ts'

const RECGOV_BASE = 'https://www.recreation.gov/api/permits'

/**
 * Fetch one month of availability for a facility.
 * Returns null payload (with reason) if the permit is seasonal/disabled.
 */
async function fetchAvailability(
  facilityId: string,
  startDate:  Date,
  apiKey:     string,
): Promise<{ payload: Record<string, Record<string, { remaining: number; total: number }>> | null; skipped?: string }> {
  const iso = new Date(startDate)
  iso.setUTCHours(0, 0, 0, 0)
  const url = `${RECGOV_BASE}/${facilityId}/availability/month` +
    `?start_date=${encodeURIComponent(iso.toISOString())}`

  const resp = await fetch(url, {
    headers: {
      'apikey':     apiKey,
      'User-Agent': 'Mozilla/5.0 (compatible; SierraPulse/1.0)',
      'Accept':     'application/json',
    },
  })

  const json = await resp.json()

  if (typeof json?.error === 'string' && json.error.toLowerCase().includes('disabled')) {
    return { payload: null, skipped: `Permit ${facilityId} not yet open for season` }
  }

  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${json?.error ?? 'unknown'}`)

  return { payload: json?.payload ?? {} }
}

/**
 * Convert availability payload → permit rows for the `permits` table.
 * trailhead_id = raw division ID (e.g. "459"), matching permit_div_ids in zone_config.ts
 */
function buildPermitRows(
  availability: Record<string, Record<string, { remaining: number; total: number }>>,
) {
  const rows: Array<{
    trailhead:    string
    trailhead_id: string
    date:         string
    quota:        number
    available:    number
    permit_type:  string
    forest:       string
  }> = []

  for (const [dateStr, divMap] of Object.entries(availability)) {
    for (const div of DIVISIONS) {
      const slot = divMap?.[div.id]
      if (!slot) continue
      rows.push({
        trailhead:    div.name,
        trailhead_id: div.id,
        date:         new Date(dateStr).toISOString().split('T')[0],
        quota:        slot.total,
        available:    slot.remaining,
        permit_type:  'overnight',
        forest:       'Inyo National Forest',
      })
    }
  }
  return rows
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const results = {
    stations_upserted: 0,
    permits_inserted:  0,
    errors: [] as string[],
  }

  const apiKey = Deno.env.get('RIDB_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing RIDB_API_KEY' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseAdmin()

  // --- Upsert stations (one per division, with zone in metadata) ---
  const stationRows = DIVISIONS.map(d => ({
    source:    'recgov',
    source_id: `${INYO_FACILITY_ID}-${d.id}`,
    name:      d.name,
    type:      'permit',
    metadata:  { zone: d.zone },
  }))

  const { error: stationErr } = await supabase
    .from('stations')
    .upsert(stationRows, { onConflict: 'source,source_id', ignoreDuplicates: false })

  if (stationErr) {
    results.errors.push(`Station upsert: ${stationErr.message}`)
  } else {
    results.stations_upserted = stationRows.length
  }

  // --- Determine fetch targets: current month + 6 months out ---
  const currentMonth = new Date()
  currentMonth.setUTCDate(1)
  currentMonth.setUTCHours(0, 0, 0, 0)

  const forwardMonth = new Date(currentMonth)
  forwardMonth.setUTCMonth(forwardMonth.getUTCMonth() + 6)

  // --- Fetch both months and merge rows ---
  const allPermitRows: ReturnType<typeof buildPermitRows> = []

  for (const target of [currentMonth, forwardMonth]) {
    try {
      const { payload, skipped } = await fetchAvailability(INYO_FACILITY_ID, target, apiKey)
      if (!payload) {
        results.errors.push(`WARN: ${skipped} (${target.toISOString().slice(0, 7)})`)
        continue
      }
      allPermitRows.push(...buildPermitRows(payload))
    } catch (err) {
      results.errors.push(`Fetch ${target.toISOString().slice(0, 7)}: ${(err as Error).message}`)
    }
  }

  // --- Write to permits table (replaces old observations approach) ---
  if (allPermitRows.length > 0) {
    const { data: inserted, error: permErr } = await supabase
      .from('permits')
      .upsert(allPermitRows, { onConflict: 'trailhead_id,date,permit_type', ignoreDuplicates: false })
      .select('id')

    if (permErr) {
      results.errors.push(`Permits upsert: ${permErr.message}`)
    } else {
      results.permits_inserted = inserted?.length ?? 0
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
