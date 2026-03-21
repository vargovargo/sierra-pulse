/**
 * ingest-roads
 * Fetches Caltrans LCS (Lane Closure System) chain-control and road closure
 * data for Sierra Nevada districts and upserts to the alerts table.
 *
 * Schedule: every 30 minutes
 * Auth: none (Caltrans cwwp2 feeds are public)
 * Target table: alerts (upsert on source,source_id)
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { SIERRA_DISTRICTS, parseLcsDistrict, lcsUrl } from './mapper.ts'

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const supabase = getSupabaseAdmin()
  const results  = { alerts_upserted: 0, errors: [] as string[] }

  const fetches = SIERRA_DISTRICTS.map(async ({ id, label }) => {
    const url  = lcsUrl(id)
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Caltrans ${label} HTTP ${resp.status}`)
    const json = await resp.json()
    console.log(`[roads] ${label}: fetched OK`)
    return parseLcsDistrict(json, label)
  })

  const settled = await Promise.allSettled(fetches)
  const allRows: object[] = []

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]
    if (result.status === 'fulfilled') {
      console.log(`[roads] ${SIERRA_DISTRICTS[i].label}: ${result.value.length} events`)
      allRows.push(...result.value)
    } else {
      const msg = `${SIERRA_DISTRICTS[i].label}: ${result.reason?.message}`
      results.errors.push(msg)
      console.error(`[roads] ${msg}`)
    }
  }

  if (allRows.length > 0) {
    const { error, count } = await supabase
      .from('alerts')
      .upsert(allRows, { onConflict: 'source,source_id', ignoreDuplicates: false })
      .select('id')

    if (error) {
      results.errors.push(`Upsert: ${error.message}`)
    } else {
      results.alerts_upserted = count ?? allRows.length
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
