#!/usr/bin/env node
/**
 * check-ingestion.js
 * Live sanity-check script: hits CDEC, USGS, and NPS APIs directly and validates
 * that the data we'd ingest looks correct before (or after) running the edge functions.
 *
 * Usage:
 *   node scripts/check-ingestion.js
 *   NPS_API_KEY=your_key node scripts/check-ingestion.js
 *
 * Exit codes:
 *   0  all checks passed (or only warnings)
 *   1  one or more critical failures
 */

// ── Value range contracts ───────────────────────────────────────────────────
const CDEC_RANGES = {
  swe:          { min: 0,   max: 300,        unit: 'inches',     label: 'Snow Water Equivalent' },
  snow_depth:   { min: 0,   max: 600,        unit: 'inches',     label: 'Snow Depth' },
  precip_accum: { min: 0,   max: 200,        unit: 'inches',     label: 'Precip Accumulation' },
  temp_air:     { min: -60, max: 130,        unit: 'fahrenheit', label: 'Air Temperature' },
}

const USGS_RANGES = {
  discharge:   { min: 0,  max: 1_000_000, unit: 'cfs',   label: 'Discharge' },
  gage_height: { min: -5, max: 100,       unit: 'feet',  label: 'Gage Height' },
}

// ── Sensor maps (must match parser.ts) ──────────────────────────────────────
const CDEC_SENSOR_MAP = {
  '3':  { parameter: 'swe',          unit: 'inches' },
  '18': { parameter: 'snow_depth',   unit: 'inches' },
  '2':  { parameter: 'precip_accum', unit: 'inches' },
  '30': { parameter: 'temp_air',     unit: 'fahrenheit' },
}

const USGS_PARAM_MAP = {
  '00060': { parameter: 'discharge',   unit: 'cfs' },
  '00065': { parameter: 'gage_height', unit: 'feet' },
}

// ── Output helpers ───────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
}

let failures = 0
let warnings = 0

function pass(msg)  { console.log(`  ${c.green}✓${c.reset} ${msg}`) }
function warn(msg)  { console.log(`  ${c.yellow}⚠${c.reset} ${msg}`); warnings++ }
function fail(msg)  { console.log(`  ${c.red}✗${c.reset} ${msg}`); failures++ }
function info(msg)  { console.log(`  ${c.dim}${msg}${c.reset}`) }
function section(title) { console.log(`\n${c.bold}${title}${c.reset}`) }

// ── CDEC check ───────────────────────────────────────────────────────────────
async function checkCdec() {
  section('CDEC — Snow Water Equivalent (Gin Flat / GIN)')

  const stationId = 'GIN'
  const sensorNums = Object.keys(CDEC_SENSOR_MAP).join(',')
  const end   = new Date()
  const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000)
  const fmt   = d => d.toISOString().slice(0, 10)
  const url   = `https://cdec.water.ca.gov/dynamicapp/req/CSVDataServlet?Stations=${stationId}&SensorNums=${sensorNums}&dur_code=H&Start=${fmt(start)}&End=${fmt(end)}`

  info(`GET ${url}`)

  let csv
  try {
    const resp = await fetch(url)
    if (!resp.ok) { fail(`HTTP ${resp.status} from CDEC`); return }
    csv = await resp.text()
  } catch (err) {
    fail(`Network error: ${err.message}`)
    return
  }

  // Basic structure check
  if (!csv || csv.trim().length === 0) {
    fail('Empty response from CDEC')
    return
  }
  pass('Response received')

  const lines = csv.split('\n').filter(l => l.trim())
  info(`${lines.length} lines in response`)

  // Header row check
  const headerLine = lines[0]
  if (!headerLine?.toUpperCase().includes('STATION_ID')) {
    fail(`Expected header row with STATION_ID, got: ${headerLine?.slice(0, 80)}`)
    return
  }
  pass('Header row present (STATION_ID found)')

  // Find data rows
  const dataLines = lines.filter(l => l.toUpperCase().startsWith(stationId.toUpperCase()))
  if (dataLines.length === 0) {
    warn('No data rows found for GIN — station may have no recent data')
    return
  }
  pass(`${dataLines.length} data rows for ${stationId}`)

  // Parse and validate a sample of rows
  let parsedCount = 0
  let skippedNodata = 0
  const paramsSeen = new Set()
  const valueIssues = []

  for (const line of dataLines) {
    // Handle quoted fields
    const cols = parseCsvLineSimple(line)
    if (cols.length < 7) continue

    const rawValue = cols[6]?.trim()
    if (!rawValue || ['---', 'ART', 'BKW', 'm', ''].includes(rawValue)) {
      skippedNodata++
      continue
    }

    const value = parseFloat(rawValue)
    if (!isFinite(value)) continue

    const sensorDesc = cols[2] ?? ''
    const sensorMatch = sensorDesc.match(/\((\d+)\)\s*$/)
    const sensorNum = sensorMatch?.[1]
    if (!sensorNum || !CDEC_SENSOR_MAP[sensorNum]) continue

    const { parameter, unit } = CDEC_SENSOR_MAP[sensorNum]
    paramsSeen.add(parameter)
    parsedCount++

    // Range check
    const range = CDEC_RANGES[parameter]
    if (range && (value < range.min || value > range.max)) {
      valueIssues.push(`${parameter} = ${value} ${unit} (expected ${range.min}–${range.max})`)
    }
  }

  info(`Skipped ${skippedNodata} nodata rows`)
  pass(`Parsed ${parsedCount} valid observations`)

  if (paramsSeen.size === 0) {
    warn('No recognized sensor parameters found in response')
  } else {
    pass(`Parameters seen: ${[...paramsSeen].sort().join(', ')}`)
  }

  if (valueIssues.length > 0) {
    for (const issue of valueIssues) {
      warn(`Out-of-range value: ${issue}`)
    }
  } else if (parsedCount > 0) {
    pass('All values within expected ranges')
  }

  // Freshness check — most recent observation should be within 24 hours
  const latestDataLine = dataLines[dataLines.length - 1]
  const latestCols = parseCsvLineSimple(latestDataLine)
  const latestDate = latestCols[4] || latestCols[5]
  if (latestDate) {
    const normalized = normalizeDateSimple(latestDate)
    if (normalized) {
      const ageHours = (Date.now() - new Date(normalized).getTime()) / 3_600_000
      if (ageHours < 24) {
        pass(`Most recent observation is ${ageHours.toFixed(1)}h old (fresh)`)
      } else {
        warn(`Most recent observation is ${ageHours.toFixed(1)}h old (stale — >24h)`)
      }
    }
  }
}

// ── USGS check ───────────────────────────────────────────────────────────────
async function checkUsgs() {
  section('USGS — Streamflow at Happy Isles, Yosemite (11264500)')

  const siteId = '11264500'
  const paramCd = Object.keys(USGS_PARAM_MAP).join(',')
  const url = `https://waterservices.usgs.gov/nwis/iv/?sites=${siteId}&parameterCd=${paramCd}&format=json&siteStatus=active&period=P2D`

  info(`GET ${url}`)

  let json
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!resp.ok) { fail(`HTTP ${resp.status} from USGS`); return }
    json = await resp.json()
  } catch (err) {
    fail(`Network error: ${err.message}`)
    return
  }

  pass('Response received')

  // Structure check
  const timeSeries = json?.value?.timeSeries
  if (!Array.isArray(timeSeries)) {
    fail('Response missing value.timeSeries array')
    return
  }
  pass(`${timeSeries.length} timeSeries in response`)

  if (timeSeries.length === 0) {
    warn('No timeSeries — gauge may be inactive or offline')
    return
  }

  let totalObs = 0
  let totalSkipped = 0

  for (const series of timeSeries) {
    const paramCode = series?.variable?.variableCode?.[0]?.value
    const siteCode  = series?.sourceInfo?.siteCode?.[0]?.value
    const siteName  = series?.sourceInfo?.siteName ?? siteCode
    const paramInfo = USGS_PARAM_MAP[paramCode]

    if (!paramInfo) {
      info(`Skipping unknown parameter ${paramCode}`)
      continue
    }

    const values = series?.values?.[0]?.value ?? []
    const valid = values.filter(v => v.value !== '-999999' && v.value != null && isFinite(parseFloat(v.value)))
    const skipped = values.length - valid.length

    info(`${siteName} — ${paramInfo.parameter}: ${valid.length} valid, ${skipped} nodata`)
    totalObs += valid.length
    totalSkipped += skipped

    if (valid.length === 0) {
      warn(`No valid values for ${siteCode} ${paramInfo.parameter}`)
      continue
    }

    // Range check on all values
    const range = USGS_RANGES[paramInfo.parameter]
    const outOfRange = valid.filter(v => {
      const n = parseFloat(v.value)
      return n < range.min || n > range.max
    })

    if (outOfRange.length > 0) {
      for (const v of outOfRange.slice(0, 3)) {
        warn(`Out-of-range: ${paramInfo.parameter} = ${v.value} ${paramInfo.unit} at ${v.dateTime}`)
      }
    }

    // Freshness check
    const latest = valid[valid.length - 1]
    if (latest?.dateTime) {
      const ageHours = (Date.now() - new Date(latest.dateTime).getTime()) / 3_600_000
      if (ageHours < 2) {
        pass(`${paramInfo.parameter}: most recent is ${(ageHours * 60).toFixed(0)}min old`)
      } else if (ageHours < 24) {
        pass(`${paramInfo.parameter}: most recent is ${ageHours.toFixed(1)}h old`)
      } else {
        warn(`${paramInfo.parameter}: most recent is ${ageHours.toFixed(1)}h old (stale — >24h)`)
      }
    }
  }

  pass(`Total: ${totalObs} valid observations, ${totalSkipped} nodata rows skipped`)

  // Site metadata check
  const firstSeries = timeSeries[0]
  const lat = firstSeries?.sourceInfo?.geoLocation?.geogLocation?.latitude
  const lon = firstSeries?.sourceInfo?.geoLocation?.geogLocation?.longitude
  if (lat && lon) {
    pass(`Station coordinates present: ${lat}, ${lon}`)
    // Rough Sierra Nevada bounding box check
    const latN = parseFloat(lat), lonN = parseFloat(lon)
    if (latN < 36 || latN > 42 || lonN < -122 || lonN > -117) {
      warn(`Coordinates (${latN}, ${lonN}) appear outside Sierra Nevada bounding box`)
    }
  } else {
    warn('Missing geoLocation — lat/lon will be null in database')
  }
}

// ── NPS check ────────────────────────────────────────────────────────────────
async function checkNps() {
  section('NPS Alerts — Yosemite')

  const apiKey = process.env.NPS_API_KEY
  if (!apiKey) {
    warn('NPS_API_KEY not set — skipping NPS check (set env var to enable)')
    return
  }

  const url = `https://developer.nps.gov/api/v1/alerts?parkCode=yose&limit=50&api_key=${apiKey}`
  info(`GET ${url.replace(apiKey, '***')}`)

  let json
  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      if (resp.status === 401) {
        fail('NPS API returned 401 — API key may be invalid or inactive')
      } else {
        fail(`HTTP ${resp.status} from NPS API`)
      }
      return
    }
    json = await resp.json()
  } catch (err) {
    fail(`Network error: ${err.message}`)
    return
  }

  pass('Response received')

  // Structure checks
  if (!Array.isArray(json?.data)) {
    fail('Response missing data array')
    return
  }
  pass(`${json.data.length} alerts in response`)

  if (json.data.length === 0) {
    info('No current alerts — normal outside of active incident season')
    return
  }

  // Validate each alert has required fields
  let missingId    = 0
  let missingTitle = 0
  const categoriesSeen = new Set()

  for (const alert of json.data) {
    if (!alert.id) missingId++
    if (!alert.title) missingTitle++
    if (alert.category) categoriesSeen.add(alert.category)
  }

  if (missingId > 0) fail(`${missingId} alerts missing 'id' field`)
  else pass('All alerts have id')

  if (missingTitle > 0) fail(`${missingTitle} alerts missing 'title' field`)
  else pass('All alerts have title')

  pass(`Categories in response: ${[...categoriesSeen].sort().join(', ')}`)

  // Spot-check first alert
  const first = json.data[0]
  info(`Sample: "${first.title}" (${first.category}) — ${first.lastIndexedDate ?? 'no date'}`)

  // Category mapping validation
  const KNOWN_CATEGORIES = ['Closure', 'Danger', 'Caution', 'Warning', 'Information', 'Hazard']
  const unknown = [...categoriesSeen].filter(c => !KNOWN_CATEGORIES.some(k => c.includes(k)))
  if (unknown.length > 0) {
    warn(`Unknown NPS categories (may need mapCategory update): ${unknown.join(', ')}`)
  } else {
    pass('All categories map to known values')
  }
}

// ── Minimal CSV helpers (no imports needed) ──────────────────────────────────
function parseCsvLineSimple(line) {
  const cols = []
  let current = '', inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = '' }
    else { current += ch }
  }
  cols.push(current.trim())
  return cols
}

function normalizeDateSimple(rawDate) {
  const t = rawDate.trim()
  if (!t) return null
  if (t.includes('/')) {
    const [datePart, timePart = '00:00'] = t.split(' ')
    const [m, d, y] = datePart.split('/')
    if (!y) return null
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}:00Z`
  }
  return t.replace(' ', 'T') + ':00Z'
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${c.bold}Sierra Pulse — Ingestion Check${c.reset}`)
  console.log(`${c.dim}${new Date().toISOString()}${c.reset}`)

  await checkCdec()
  await checkUsgs()
  await checkNps()

  console.log()
  if (failures > 0) {
    console.log(`${c.red}${c.bold}FAILED${c.reset} — ${failures} failure(s), ${warnings} warning(s)`)
    process.exit(1)
  } else if (warnings > 0) {
    console.log(`${c.yellow}${c.bold}PASSED with warnings${c.reset} — 0 failures, ${warnings} warning(s)`)
  } else {
    console.log(`${c.green}${c.bold}ALL CHECKS PASSED${c.reset}`)
  }
}

main().catch(err => {
  console.error(`${c.red}Unexpected error:${c.reset}`, err)
  process.exit(1)
})
