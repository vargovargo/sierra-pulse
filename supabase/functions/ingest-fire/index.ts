/**
 * ingest-fire
 * Fetches active fire perimeters from NIFC ArcGIS for the Sierra Nevada
 * bounding box, simplifies polygon geometry with RDP, and upserts to
 * the fire_perimeters table.
 *
 * Schedule: every 30 minutes during fire season (May–Nov); daily otherwise
 * Auth: none (NIFC is public)
 * Target table: fire_perimeters (upsert on irwin_id)
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { mapFireFeature } from './parser.ts'

const NIFC_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services' +
  '/WFIGS_Interagency_Perimeters_YTD/FeatureServer/0/query'

// Sierra Nevada bounding box (WGS84)
const SIERRA_BBOX = JSON.stringify({
  xmin: -122, ymin: 35.5, xmax: -116, ymax: 39.5,
  spatialReference: { wkid: 4326 },
})

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const supabase = getSupabaseAdmin()
  const results  = { perimeters_upserted: 0, skipped_no_irwin: 0, errors: [] as string[] }

  try {
    const params = new URLSearchParams({
      f:              'json',
      where:          '1=1',
      outFields:      'IncidentName,IrwinID,GISAcres,PercentContained,CreateDate,FeatureCategory',
      geometry:       SIERRA_BBOX,
      geometryType:   'esriGeometryEnvelope',
      spatialRel:     'esriSpatialRelIntersects',
      outSR:          '4326',
      returnGeometry: 'true',
    })

    const resp = await fetch(`${NIFC_URL}?${params}`)
    if (!resp.ok) throw new Error(`NIFC HTTP ${resp.status}`)

    const json     = await resp.json()
    const features = json?.features ?? []
    console.log(`[fire] fetched ${features.length} features from NIFC`)

    const rows = []
    for (const f of features) {
      const row = mapFireFeature(f)
      if (row) {
        rows.push(row)
      } else if (f?.attributes?.IncidentName) {
        // Had a name but no IrwinID — count as skipped
        results.skipped_no_irwin++
        console.warn(`[fire] skipped "${f.attributes.IncidentName}" — no IrwinID`)
      }
    }

    if (rows.length > 0) {
      const { error, count } = await supabase
        .from('fire_perimeters')
        .upsert(rows, { onConflict: 'irwin_id', ignoreDuplicates: false })
        .select('id')

      if (error) {
        results.errors.push(`Upsert: ${error.message}`)
      } else {
        results.perimeters_upserted = count ?? rows.length
      }
    }
  } catch (err: any) {
    results.errors.push(err.message)
    console.error('[fire] fatal:', err.message)
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
