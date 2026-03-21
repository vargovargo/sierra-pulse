/**
 * Pure AirNow API mapping logic — no Deno or external imports.
 * AirNow API: https://docs.airnowapi.org/
 */

export type AqiCategory = 'good' | 'moderate' | 'unhealthy-sensitive' | 'unhealthy' | 'hazardous'

/**
 * Map AQI numeric category to a named category.
 * AirNow Category.Number: 1=Good, 2=Moderate, 3=USG (Unhealthy for Sensitive Groups),
 * 4=Unhealthy, 5=Very Unhealthy, 6=Hazardous
 */
export function mapAqiCategory(aqiValue: number): AqiCategory {
  if (aqiValue <= 50)  return 'good'
  if (aqiValue <= 100) return 'moderate'
  if (aqiValue <= 150) return 'unhealthy-sensitive'
  if (aqiValue <= 200) return 'unhealthy'
  return 'hazardous'
}

/**
 * Strike window air quality check.
 * Returns 'clear' | 'caution' | 'blocked' for use in Phase 5 strike window engine.
 */
export function aqiStrikeStatus(aqi: number): 'clear' | 'caution' | 'blocked' {
  if (aqi <= 100) return 'clear'
  if (aqi <= 150) return 'caution'
  return 'blocked'
}

export interface AirNowObsRow {
  parameter:   'aqi' | 'pm25'
  value:       number
  unit:        string
  observed_at: string
  category:    AqiCategory
}

export interface AirNowApiRecord {
  DateObserved:   string
  HourObserved:   number
  LocalTimeZone:  string
  ReportingArea:  string
  StateCode:      string
  Latitude:       number
  Longitude:      number
  ParameterName:  string
  AQI:            number
  Category:       { Number: number; Name: string }
}

/**
 * Parse AirNow API response into normalized observation rows.
 * Returns both AQI and PM2.5 rows when present.
 */
export function parseAirNowResponse(data: unknown): AirNowObsRow[] {
  if (!Array.isArray(data)) return []

  const rows: AirNowObsRow[] = []

  for (const record of data as AirNowApiRecord[]) {
    if (record.AQI == null || !record.DateObserved) continue

    // Build ISO timestamp from DateObserved + HourObserved
    const dateStr = record.DateObserved.trim() // e.g. "2026-03-14 "
    const hour    = record.HourObserved ?? 0
    // Append 'Z' to force UTC — AirNow doesn't include tz offset in this endpoint.
    // Full timezone handling (using LocalTimeZone field) deferred to Phase 3+.
    const observed_at = new Date(`${dateStr.trim()}T${String(hour).padStart(2, '0')}:00:00Z`).toISOString()

    const aqi      = Number(record.AQI)
    const category = mapAqiCategory(aqi)
    const param    = record.ParameterName?.toLowerCase()

    // Emit AQI row for all parameters
    rows.push({
      parameter:   'aqi',
      value:       aqi,
      unit:        'AQI',
      observed_at,
      category,
    })

    // Emit PM2.5-specific row
    if (param === 'pm2.5') {
      rows.push({
        parameter:   'pm25',
        value:       aqi,   // AirNow returns AQI-equivalent, not raw µg/m³ in this endpoint
        unit:        'AQI',
        observed_at,
        category,
      })
    }
  }

  return rows
}

export interface AirNowWarning {
  parameter: string
  value:     number
  message:   string
}

const AIRNOW_RANGES: Record<string, { min: number; max: number }> = {
  aqi:  { min: 0, max: 500 },
  pm25: { min: 0, max: 500 },
}

export function filterValidRows(rows: AirNowObsRow[]): AirNowObsRow[] {
  return rows.filter(row => {
    const range = AIRNOW_RANGES[row.parameter]
    if (!range) return true
    if (row.value < range.min || row.value > range.max) return false
    if (!row.observed_at || isNaN(Date.parse(row.observed_at))) return false
    return true
  })
}

export function validateAirNowRows(rows: AirNowObsRow[]): AirNowWarning[] {
  const warnings: AirNowWarning[] = []
  for (const row of rows) {
    const range = AIRNOW_RANGES[row.parameter]
    if (!range) continue
    if (row.value < range.min || row.value > range.max) {
      warnings.push({
        parameter: row.parameter,
        value:     row.value,
        message:   `Value ${row.value} ${row.unit} out of expected range [${range.min}, ${range.max}]`,
      })
    }
    if (!row.observed_at || isNaN(Date.parse(row.observed_at))) {
      warnings.push({
        parameter: row.parameter,
        value:     row.value,
        message:   `Invalid observed_at: ${row.observed_at}`,
      })
    }
  }
  return warnings
}
