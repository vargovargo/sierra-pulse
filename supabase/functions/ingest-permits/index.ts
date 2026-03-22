/**
 * ingest-permits
 * Fetches overnight wilderness permit availability from Recreation.gov
 * for Eastern Sierra (Bishop area) trailhead entry points.
 *
 * Uses the Inyo-specific v2 availability endpoint (no API key required):
 *   GET /api/permitinyo/{facilityId}/availabilityv2?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&commercial_acct=false
 *
 * Fetches today through +6 months in a single request.
 * Writes rows to the `permits` table (trailhead / date / available / quota).
 *
 * Schedule: every 2 hours (0 *\/2 * * *)
 * Auth: none required
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin }        from '../_shared/supabaseAdmin.ts'
import { INYO_FACILITY_ID, DIVISIONS } from './divisions.ts'

const RECGOV_BASE = 'https://www.recreation.gov/api/permitinyo'

interface DivisionSlot {
  quota_usage_by_member_daily: { total: number; remaining: number }
  is_walkup:        boolean
  not_yet_released?: boolean
  release_date?:     string
}

type AvailabilityPayload = Record<string, Record<string, DivisionSlot>>

async function fetchAvailability(
  facilityId: string,
  startDate:  string,  // YYYY-MM-DD
  endDate:    string,  // YYYY-MM-DD
): Promise<AvailabilityPayload> {
  const url = `${RECGOV_BASE}/${facilityId}/availabilityv2` +
    `?start_date=${startDate}&end_date=${endDate}&commercial_acct=false`

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SierraPulse/1.0)',
      'Accept':     'application/json',
    },
  })

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const json = await resp.json()
  return json?.payload ?? {}
}

function buildPermitRows(payload: AvailabilityPayload) {
  const rows: Array<{
    trailhead:    string
    trailhead_id: string
    date:         string
    quota:        number
    available:    number
    permit_type:  string
    forest:       string
  }> = []

  for (const [dateStr, divMap] of Object.entries(payload)) {
    for (const div of DIVISIONS) {
      const slot = divMap?.[div.id]
      if (!slot) continue
      const { total, remaining } = slot.quota_usage_by_member_daily
      rows.push({
        trailhead:    div.name,
        trailhead_id: div.id,
        date:         dateStr.split('T')[0],
        quota:        total,
        available:    remaining,
        permit_type:  'overnight',
        forest:       'Inyo National Forest',
      })
    }
  }
  return rows
}

/** First and last day of a month offset by N months from today, as YYYY-MM-DD strings */
function monthRange(offsetMonths: number): { start: string; end: string } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  const start = d.toISOString().split('T')[0]
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const end = last.toISOString().split('T')[0]
  return { start, end }
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const results = {
    stations_upserted: 0,
    permits_inserted:  0,
    errors: [] as string[],
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

  // --- Fetch month by month, current through +6 months ---
  const allPermitRows: ReturnType<typeof buildPermitRows> = []

  for (let m = 0; m <= 6; m++) {
    const { start, end } = monthRange(m)
    try {
      const payload = await fetchAvailability(INYO_FACILITY_ID, start, end)
      allPermitRows.push(...buildPermitRows(payload))
    } catch (err) {
      results.errors.push(`Fetch ${start.slice(0, 7)}: ${(err as Error).message}`)
    }
  }

  try {
    const permitRows = allPermitRows

    if (permitRows.length > 0) {
      const { data: inserted, error: permErr } = await supabase
        .from('permits')
        .upsert(permitRows, { onConflict: 'trailhead_id,date,permit_type', ignoreDuplicates: false })
        .select('id')

      if (permErr) {
        results.errors.push(`Permits upsert: ${permErr.message}`)
      } else {
        results.permits_inserted = inserted?.length ?? 0
      }
    }
  } catch (err) {
    results.errors.push(`Fetch: ${(err as Error).message}`)
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
