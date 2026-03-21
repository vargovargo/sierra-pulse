/**
 * ingest-nps-alerts
 * Fetches park alerts (closures, hazards, conditions) from the NPS API
 * for Sierra Nevada parks: Yosemite, Sequoia-Kings Canyon, Devils Postpile.
 *
 * Schedule: every 2 hours
 * Auth: NPS_API_KEY (set via: supabase secrets set NPS_API_KEY=...)
 * Target table: alerts (upsert on source + source_id)
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { parseNpsAlerts, validateNpsAlerts } from './mapper.ts'

const NPS_API_BASE = 'https://developer.nps.gov/api/v1'

const PARK_CODES = [
  { code: 'yose', name: 'Yosemite National Park' },
  { code: 'seki', name: 'Sequoia-Kings Canyon National Parks' },
  { code: 'depo', name: 'Devils Postpile National Monument' },
]

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const apiKey = Deno.env.get('NPS_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'NPS_API_KEY not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseAdmin()
  const results = { alerts_upserted: 0, errors: [] as string[] }

  const fetches = PARK_CODES.map(async ({ code, name }) => {
    const url = `${NPS_API_BASE}/alerts?parkCode=${code}&limit=100&api_key=${apiKey}`
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`NPS ${code} HTTP ${resp.status}`)
    const json = await resp.json()
    return parseNpsAlerts(json.data ?? [], name)
  })

  const settled = await Promise.allSettled(fetches)
  const allAlerts: object[] = []

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]
    if (result.status === 'fulfilled') {
      // Validate data quality
      const warnings = validateNpsAlerts(result.value)
      for (const w of warnings) {
        console.warn(`[nps] ${w.message} (alert ${w.source_id})`)
        results.errors.push(`WARN: ${w.message}`)
      }
      allAlerts.push(...result.value)
    } else {
      results.errors.push(`${PARK_CODES[i].code}: ${result.reason?.message}`)
    }
  }

  if (allAlerts.length > 0) {
    const { error, count } = await supabase
      .from('alerts')
      .upsert(allAlerts, { onConflict: 'source,source_id', ignoreDuplicates: false })
      .select('id')

    if (error) {
      results.errors.push(`Upsert: ${error.message}`)
    } else {
      results.alerts_upserted = count ?? allAlerts.length
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
