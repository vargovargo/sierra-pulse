/**
 * ingest-nws
 * Fetches active NWS weather alerts for the Eastern Sierra / Bishop area.
 * Stores Extreme/Severe alerts as 'danger', Moderate as 'caution' in the alerts table.
 *
 * compute-strike-windows reads these to block or cap zone scores:
 *   danger  → score = 0, status = 'blocked'
 *   caution → score capped at 60
 *
 * Schedule: every 30 minutes (recommended — alerts can appear quickly)
 * Auth: none (NWS API is public, no key required)
 * Target table: alerts (source='nws')
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin }        from '../_shared/supabaseAdmin.ts'
import { SIERRA_NWS_ZONES, nwsSeverityToCategory } from './zones.ts'

const NWS_BASE = 'https://api.weather.gov'

interface NwsAlert {
  id: string
  properties: {
    id:          string
    event:       string
    severity:    string
    headline:    string | null
    description: string | null
    expires:     string | null
    areaDesc:    string | null
  }
}

async function fetchActiveAlerts(zones: string[]): Promise<NwsAlert[]> {
  const url = `${NWS_BASE}/alerts/active?zone=${zones.join(',')}&status=actual&message_type=alert,update`
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'SierraPulse/1.0 (contact@sierrapulse.app)',
      'Accept':     'application/geo+json',
    },
  })
  if (!resp.ok) throw new Error(`NWS API HTTP ${resp.status}`)
  const json = await resp.json()
  return (json?.features ?? []) as NwsAlert[]
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const results = {
    alerts_upserted: 0,
    alerts_expired:  0,
    errors: [] as string[],
  }

  const supabase = getSupabaseAdmin()

  // --- Fetch active alerts from NWS ---
  let rawAlerts: NwsAlert[]
  try {
    rawAlerts = await fetchActiveAlerts(SIERRA_NWS_ZONES)
  } catch (err) {
    results.errors.push(`NWS fetch: ${(err as Error).message}`)
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- Build alert rows (skip Minor/Unknown severity) ---
  const alertRows = rawAlerts
    .filter(a => ['Extreme', 'Severe', 'Moderate'].includes(a.properties.severity))
    .map(a => ({
      source:        'nws' as const,
      source_id:     a.properties.id,
      title:         a.properties.event,
      description:   a.properties.headline ?? a.properties.description ?? null,
      category:      nwsSeverityToCategory(a.properties.severity),
      park_or_forest: a.properties.areaDesc ?? 'Eastern Sierra',
      expires_at:    a.properties.expires ? new Date(a.properties.expires).toISOString() : null,
    }))

  if (alertRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('alerts')
      .upsert(alertRows, { onConflict: 'source,source_id', ignoreDuplicates: false })

    if (upsertErr) {
      results.errors.push(`Alerts upsert: ${upsertErr.message}`)
    } else {
      results.alerts_upserted = alertRows.length
    }
  }

  // --- Delete expired NWS alerts (keep table clean) ---
  const { error: deleteErr, count } = await supabase
    .from('alerts')
    .delete({ count: 'exact' })
    .eq('source', 'nws')
    .lt('expires_at', new Date().toISOString())

  if (deleteErr) {
    results.errors.push(`Expire cleanup: ${deleteErr.message}`)
  } else {
    results.alerts_expired = count ?? 0
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
