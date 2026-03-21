/**
 * Pure CDEC CSV parsing logic — no Deno or external imports.
 * Extracted so it can be unit-tested outside of the edge function runtime.
 */

export const SENSOR_MAP: Record<string, { parameter: string; unit: string }> = {
  '3':  { parameter: 'swe',          unit: 'inches' },
  '18': { parameter: 'snow_depth',   unit: 'inches' },
  '2':  { parameter: 'precip_accum', unit: 'inches' },
  '30': { parameter: 'temp_air',     unit: 'fahrenheit' },
}

export interface CdecRow {
  stationId:  string
  sensorNum:  string
  parameter:  string
  unit:       string
  observedAt: string
  value:      number
}

/** Minimal quoted-CSV line parser. Handles fields like "SNOW, WATER CONTENT (3)". */
export function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      cols.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cols.push(current.trim())
  return cols
}

/** Normalize CDEC date strings to ISO-8601.
 *  Handles three formats actually returned by CDEC:
 *    "YYYYMMDD HH:MM"   — e.g. "20260313 0000"  (most common in CSV API)
 *    "MM/DD/YYYY HH:MM" — e.g. "03/13/2026 00:00"
 *    "YYYY-MM-DD HH:MM" — e.g. "2026-03-13 00:00"
 */
export function normalizeCdecDate(rawDate: string): string | null {
  const trimmed = rawDate.trim()
  if (!trimmed) return null

  // YYYYMMDD HH:MM  (no separators in date part)
  if (/^\d{8}\s/.test(trimmed)) {
    const [datePart, timePart = '00:00'] = trimmed.split(' ')
    const y = datePart.slice(0, 4)
    const m = datePart.slice(4, 6)
    const d = datePart.slice(6, 8)
    const t = timePart.length === 4 ? `${timePart.slice(0,2)}:${timePart.slice(2)}` : timePart
    return `${y}-${m}-${d}T${t}:00Z`
  }

  if (trimmed.includes('/')) {
    // MM/DD/YYYY HH:MM
    const [datePart, timePart = '00:00'] = trimmed.split(' ')
    const parts = datePart.split('/')
    if (parts.length !== 3) return null
    const [m, d, y] = parts
    if (!y || !m || !d) return null
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}:00Z`
  }

  // YYYY-MM-DD HH:MM
  if (!/^\d{4}-\d{2}-\d{2}[\sT]/.test(trimmed)) return null
  return trimmed.replace(' ', 'T') + ':00Z'
}

/** Nodata sentinel values CDEC uses — skip these rows. */
const NODATA_VALUES = new Set(['---', 'ART', 'BKW', 'm', ''])

/**
 * Parse a CDEC CSV response for a single station.
 *
 * CDEC column layout (9 cols, as returned by CSVDataServlet):
 *   0: STATION_ID
 *   1: DURATION
 *   2: SENSOR_NUMBER       ← raw number, e.g. "3"
 *   3: SENSOR_TYPE         ← short label, e.g. "SNOW WC"
 *   4: DATE TIME           ← primary date, "YYYYMMDD HH:MM"
 *   5: OBS DATE            ← same or fallback date
 *   6: VALUE
 *   7: DATA_FLAG
 *   8: UNITS
 */
export function parseCdecCsv(stationId: string, csv: string): CdecRow[] {
  const rows: CdecRow[] = []
  let dataStarted = false

  for (const rawLine of csv.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    // Skip header rows until we see a row starting with the station ID
    if (!dataStarted) {
      if (line.toUpperCase().startsWith(stationId.toUpperCase())) {
        dataStarted = true
      } else {
        continue
      }
    }

    const cols = parseCsvLine(line)
    if (cols.length < 7) continue

    const rawValue = cols[6]
    if (!rawValue || NODATA_VALUES.has(rawValue)) continue

    const value = parseFloat(rawValue)
    if (!isFinite(value)) continue

    // Col 2 is the sensor number directly (e.g. "3").
    // Fallback: extract from a description like "SNOW, WATER CONTENT (3)" in case
    // CDEC ever returns the older verbose format.
    const col2 = (cols[2] ?? '').trim()
    const sensorMatch = col2.match(/\((\d+)\)\s*$/)
    const sensorNum = sensorMatch ? sensorMatch[1] : col2
    if (!SENSOR_MAP[sensorNum]) continue

    const rawDate = cols[4] || cols[5]
    if (!rawDate) continue

    const observedAt = normalizeCdecDate(rawDate)
    if (!observedAt) continue

    rows.push({
      stationId,
      sensorNum,
      parameter: SENSOR_MAP[sensorNum].parameter,
      unit:      SENSOR_MAP[sensorNum].unit,
      observedAt,
      value,
    })
  }

  return rows
}

export function buildCdecUrl(stationId: string, sensorNums: string[], daysBack = 2): string {
  const end   = new Date()
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000)
  const fmt   = (d: Date) => d.toISOString().slice(0, 10)
  return (
    `https://cdec.water.ca.gov/dynamicapp/req/CSVDataServlet` +
    `?Stations=${stationId}` +
    `&SensorNums=${sensorNums.join(',')}` +
    `&dur_code=H` +
    `&Start=${fmt(start)}` +
    `&End=${fmt(end)}`
  )
}

/** Sanity-check parsed rows for obviously wrong values. Returns a list of warnings. */
export interface CdecWarning {
  stationId: string
  parameter: string
  value:     number
  message:   string
}

const CDEC_RANGES: Record<string, { min: number; max: number }> = {
  swe:          { min: 0,   max: 300 },
  snow_depth:   { min: 0,   max: 600 },
  precip_accum: { min: 0,   max: 200 },
  temp_air:     { min: -60, max: 130 },
}

export function validateCdecRows(rows: CdecRow[]): CdecWarning[] {
  const warnings: CdecWarning[] = []
  for (const row of rows) {
    const range = CDEC_RANGES[row.parameter]
    if (!range) continue
    if (row.value < range.min || row.value > range.max) {
      warnings.push({
        stationId: row.stationId,
        parameter: row.parameter,
        value:     row.value,
        message:   `Value ${row.value} ${row.unit} out of expected range [${range.min}, ${range.max}]`,
      })
    }
  }
  return warnings
}

export function filterValidRows(rows: CdecRow[]): CdecRow[] {
  return rows.filter(row => {
    const range = CDEC_RANGES[row.parameter]
    if (!range) return true
    return row.value >= range.min && row.value <= range.max
  })
}
