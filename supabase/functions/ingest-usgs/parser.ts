/**
 * Pure USGS Water Services JSON parsing logic — no Deno or external imports.
 */

export const PARAM_MAP: Record<string, { parameter: string; unit: string }> = {
  '00060': { parameter: 'discharge',   unit: 'cfs' },
  '00065': { parameter: 'gage_height', unit: 'feet' },
}

// USGS nodata sentinel value
const USGS_NODATA = '-999999'

export interface UsgsObsRow {
  source_id:   string
  name:        string
  lat:         number | null
  lon:         number | null
  observed_at: string
  parameter:   string
  value:       number
  unit:        string
}

// TODO: USGS migrating to api.waterdata.usgs.gov by early 2027 — test new API before cutover
// Flip USGS_API_VERSION=new to test the next-gen endpoint during transition.
export function buildUsgsUrl(siteIds: string[]): string {
  const NEW_API = typeof Deno !== 'undefined' && Deno.env.get('USGS_API_VERSION') === 'new'
  const params  = new URLSearchParams({
    sites:       siteIds.join(','),
    parameterCd: Object.keys(PARAM_MAP).join(','),
    format:      'json',
    siteStatus:  'active',
    period:      'P2D',
  })
  const base = NEW_API
    ? 'https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily-summaries/items'
    : 'https://waterservices.usgs.gov/nwis/iv/'
  return `${base}?${params}`
}

export function parseUsgsResponse(json: unknown): UsgsObsRow[] {
  const rows: UsgsObsRow[] = []

  // Type-safe traversal
  const timeSeries = (json as any)?.value?.timeSeries
  if (!Array.isArray(timeSeries)) return rows

  for (const series of timeSeries) {
    const siteCode  = series?.sourceInfo?.siteCode?.[0]?.value
    const name      = series?.sourceInfo?.siteName ?? siteCode
    const geoLoc    = series?.sourceInfo?.geoLocation?.geogLocation
    const lat       = geoLoc?.latitude  != null ? parseFloat(geoLoc.latitude)  : null
    const lon       = geoLoc?.longitude != null ? parseFloat(geoLoc.longitude) : null
    const paramCode = series?.variable?.variableCode?.[0]?.value

    if (!siteCode || !PARAM_MAP[paramCode]) continue

    const values: any[] = series?.values?.[0]?.value ?? []

    for (const obs of values) {
      if (obs.value === USGS_NODATA || obs.value == null) continue
      const value = parseFloat(obs.value)
      if (!isFinite(value)) continue
      if (!obs.dateTime) continue

      rows.push({
        source_id:   siteCode,
        name,
        lat:         isFinite(lat as number) ? lat : null,
        lon:         isFinite(lon as number) ? lon : null,
        observed_at: obs.dateTime,
        parameter:   PARAM_MAP[paramCode].parameter,
        value,
        unit:        PARAM_MAP[paramCode].unit,
      })
    }
  }

  return rows
}

export interface UsgsWarning {
  source_id: string
  parameter: string
  value:     number
  message:   string
}

const USGS_RANGES: Record<string, { min: number; max: number }> = {
  discharge:   { min: 0,  max: 1_000_000 },
  gage_height: { min: -5, max: 100 },
}

export function validateUsgsRows(rows: UsgsObsRow[]): UsgsWarning[] {
  const warnings: UsgsWarning[] = []
  for (const row of rows) {
    const range = USGS_RANGES[row.parameter]
    if (!range) continue
    if (row.value < range.min || row.value > range.max) {
      warnings.push({
        source_id: row.source_id,
        parameter: row.parameter,
        value:     row.value,
        message:   `Value ${row.value} ${row.unit} out of expected range [${range.min}, ${range.max}]`,
      })
    }
  }
  return warnings
}

export function filterValidRows(rows: UsgsObsRow[]): UsgsObsRow[] {
  return rows.filter(row => {
    const range = USGS_RANGES[row.parameter]
    if (!range) return true
    return row.value >= range.min && row.value <= range.max
  })
}
