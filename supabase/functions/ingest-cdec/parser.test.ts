import { describe, it, expect } from 'vitest'
import {
  parseCsvLine,
  normalizeCdecDate,
  parseCdecCsv,
  validateCdecRows,
  buildCdecUrl,
  SENSOR_MAP,
} from './parser'

// ---------------------------------------------------------------------------
// parseCsvLine
// ---------------------------------------------------------------------------
describe('parseCsvLine', () => {
  it('splits a plain CSV line', () => {
    expect(parseCsvLine('GIN,H,SNOW DEPTH (18),Inches,04/01/2024 06:00,,54.0,,Inches'))
      .toEqual(['GIN', 'H', 'SNOW DEPTH (18)', 'Inches', '04/01/2024 06:00', '', '54.0', '', 'Inches'])
  })

  it('handles quoted fields containing commas', () => {
    const result = parseCsvLine('GIN,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 06:00,,18.2,,Inches')
    expect(result[2]).toBe('SNOW, WATER CONTENT (3)')
    expect(result[6]).toBe('18.2')
  })

  it('trims whitespace from each field', () => {
    const result = parseCsvLine('GIN , H , SNOW DEPTH (18) , Inches')
    expect(result[0]).toBe('GIN')
    expect(result[2]).toBe('SNOW DEPTH (18)')
  })
})

// ---------------------------------------------------------------------------
// normalizeCdecDate
// ---------------------------------------------------------------------------
describe('normalizeCdecDate', () => {
  it('converts MM/DD/YYYY HH:MM to ISO', () => {
    expect(normalizeCdecDate('04/01/2024 06:00')).toBe('2024-04-01T06:00:00Z')
  })

  it('converts M/D/YYYY HH:MM (single-digit month/day) to ISO', () => {
    expect(normalizeCdecDate('4/1/2024 09:00')).toBe('2024-04-01T09:00:00Z')
  })

  it('converts YYYY-MM-DD HH:MM to ISO', () => {
    expect(normalizeCdecDate('2024-04-01 12:00')).toBe('2024-04-01T12:00:00Z')
  })

  it('returns null for empty string', () => {
    expect(normalizeCdecDate('')).toBeNull()
  })

  it('returns null for malformed date', () => {
    expect(normalizeCdecDate('not-a-date')).toBeNull()
  })

  it('converts YYYYMMDD HH:MM to ISO (real CDEC CSV API format)', () => {
    expect(normalizeCdecDate('20260313 0000')).toBe('2026-03-13T00:00:00Z')
  })

  it('converts YYYYMMDD HHMM (no colon) to ISO', () => {
    expect(normalizeCdecDate('20260313 1430')).toBe('2026-03-13T14:30:00Z')
  })
})

// ---------------------------------------------------------------------------
// parseCdecCsv — happy path
// ---------------------------------------------------------------------------
describe('parseCdecCsv — happy path', () => {
  // Real CDEC CSV format: quoted description with embedded comma
  const CDEC_CSV = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
GIN,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 06:00,04/01/2024 06:00,18.2,,Inches
GIN,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 07:00,04/01/2024 07:00,18.4,,Inches
GIN,H,SNOW DEPTH (18),Inches,04/01/2024 06:00,04/01/2024 06:00,54.0,,Inches
GIN,H,"PRECIPITATION, ACCUMULATED (2)",Inches,04/01/2024 06:00,04/01/2024 06:00,12.5,,Inches
GIN,H,AIR TEMPERATURE (30),Fahrenheit,04/01/2024 06:00,04/01/2024 06:00,32.0,,Fahrenheit
`

  it('parses multiple sensor types', () => {
    const rows = parseCdecCsv('GIN', CDEC_CSV)
    expect(rows.length).toBe(5)
  })

  it('correctly maps sensor (3) to swe parameter', () => {
    const rows = parseCdecCsv('GIN', CDEC_CSV)
    const sweRows = rows.filter(r => r.parameter === 'swe')
    expect(sweRows.length).toBe(2)
    expect(sweRows[0].value).toBe(18.2)
    expect(sweRows[0].unit).toBe('inches')
  })

  it('correctly maps sensor (18) to snow_depth', () => {
    const rows = parseCdecCsv('GIN', CDEC_CSV)
    const depthRow = rows.find(r => r.parameter === 'snow_depth')
    expect(depthRow?.value).toBe(54.0)
    expect(depthRow?.unit).toBe('inches')
  })

  it('correctly maps sensor (30) to temp_air', () => {
    const rows = parseCdecCsv('GIN', CDEC_CSV)
    const tempRow = rows.find(r => r.parameter === 'temp_air')
    expect(tempRow?.value).toBe(32.0)
    expect(tempRow?.unit).toBe('fahrenheit')
  })

  it('normalizes date to ISO format', () => {
    const rows = parseCdecCsv('GIN', CDEC_CSV)
    expect(rows[0].observedAt).toBe('2024-04-01T06:00:00Z')
  })

  it('attaches the correct stationId', () => {
    const rows = parseCdecCsv('GIN', CDEC_CSV)
    expect(rows.every(r => r.stationId === 'GIN')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// parseCdecCsv — nodata & edge cases
// ---------------------------------------------------------------------------
describe('parseCdecCsv — nodata handling', () => {
  it('skips --- nodata rows', () => {
    const csv = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
GIN,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 06:00,04/01/2024 06:00,---,,Inches
GIN,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 07:00,04/01/2024 07:00,18.2,,Inches
`
    const rows = parseCdecCsv('GIN', csv)
    expect(rows.length).toBe(1)
    expect(rows[0].value).toBe(18.2)
  })

  it('skips ART sentinel', () => {
    const csv = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
GIN,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 06:00,04/01/2024 06:00,ART,,Inches
`
    expect(parseCdecCsv('GIN', csv)).toHaveLength(0)
  })

  it('skips BKW sentinel', () => {
    const csv = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
GIN,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 06:00,04/01/2024 06:00,BKW,,Inches
`
    expect(parseCdecCsv('GIN', csv)).toHaveLength(0)
  })

  it('skips non-numeric values', () => {
    const csv = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
GIN,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 06:00,04/01/2024 06:00,ERR,,Inches
`
    expect(parseCdecCsv('GIN', csv)).toHaveLength(0)
  })

  it('skips rows with unknown sensor number', () => {
    const csv = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
GIN,H,UNKNOWN SENSOR (99),inches,04/01/2024 06:00,04/01/2024 06:00,5.0,,inches
`
    expect(parseCdecCsv('GIN', csv)).toHaveLength(0)
  })

  it('returns empty array for header-only CSV', () => {
    const csv = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS\n`
    expect(parseCdecCsv('GIN', csv)).toHaveLength(0)
  })

  it('returns empty array for empty string', () => {
    expect(parseCdecCsv('GIN', '')).toHaveLength(0)
  })

  it('handles ISO date format (YYYY-MM-DD HH:MM)', () => {
    const csv = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
GIN,H,"SNOW, WATER CONTENT (3)",Inches,2024-04-01 08:00,,20.0,,Inches
`
    const rows = parseCdecCsv('GIN', csv)
    expect(rows[0].observedAt).toBe('2024-04-01T08:00:00Z')
  })

  it('parses real CDEC CSVDataServlet format (plain sensor number, YYYYMMDD date)', () => {
    const csv = `STATION_ID,DURATION,SENSOR_NUMBER,SENSOR_TYPE,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
GIN,H,3,SNOW WC,20260313 0000,20260313 0000,8.38, ,INCHES
GIN,H,3,SNOW WC,20260313 0100,20260313 0100,8.34, ,INCHES
`
    const rows = parseCdecCsv('GIN', csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].parameter).toBe('swe')
    expect(rows[0].value).toBe(8.38)
    expect(rows[0].observedAt).toBe('2026-03-13T00:00:00Z')
    expect(rows[1].value).toBe(8.34)
  })

  it('is case-insensitive for station ID matching', () => {
    const csv = `STATION_ID,DUR_CODE,SENSOR_DESCRIPTION,SENSOR_UNITS,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS
gin,H,"SNOW, WATER CONTENT (3)",Inches,04/01/2024 06:00,04/01/2024 06:00,18.2,,Inches
`
    const rows = parseCdecCsv('GIN', csv)
    expect(rows).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// validateCdecRows
// ---------------------------------------------------------------------------
describe('validateCdecRows', () => {
  const makeRow = (parameter: string, value: number) => ({
    stationId: 'GIN', sensorNum: '3', parameter, unit: 'inches',
    observedAt: '2024-04-01T06:00:00Z', value,
  })

  it('returns no warnings for normal values', () => {
    const rows = [
      makeRow('swe', 24.0),
      makeRow('snow_depth', 72.0),
      makeRow('temp_air', 28.0),
    ]
    expect(validateCdecRows(rows)).toHaveLength(0)
  })

  it('flags swe above 300 inches', () => {
    const warnings = validateCdecRows([makeRow('swe', 350)])
    expect(warnings).toHaveLength(1)
    expect(warnings[0].parameter).toBe('swe')
    expect(warnings[0].value).toBe(350)
  })

  it('flags negative swe', () => {
    const warnings = validateCdecRows([makeRow('swe', -1)])
    expect(warnings).toHaveLength(1)
  })

  it('flags temp_air above 130°F', () => {
    const warnings = validateCdecRows([makeRow('temp_air', 200)])
    expect(warnings[0].parameter).toBe('temp_air')
  })

  it('flags temp_air below -60°F', () => {
    const warnings = validateCdecRows([makeRow('temp_air', -100)])
    expect(warnings).toHaveLength(1)
  })

  it('returns no warnings for unknown parameter (no range defined)', () => {
    const warnings = validateCdecRows([makeRow('unknown_param', 9999)])
    expect(warnings).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// buildCdecUrl
// ---------------------------------------------------------------------------
describe('buildCdecUrl', () => {
  it('includes station ID and sensor numbers', () => {
    const url = buildCdecUrl('GIN', ['3', '18'])
    expect(url).toContain('Stations=GIN')
    // buildCdecUrl uses string concatenation — comma is literal, not percent-encoded
    expect(url).toContain('SensorNums=3,18')
  })

  it('includes Start and End date params', () => {
    const url = buildCdecUrl('GIN', ['3'], 2)
    expect(url).toContain('Start=')
    expect(url).toContain('End=')
  })

  it('uses H (hourly) duration code', () => {
    const url = buildCdecUrl('GIN', ['3'])
    expect(url).toContain('dur_code=H')
  })

  it('points to the CDEC domain', () => {
    const url = buildCdecUrl('GIN', ['3'])
    expect(url).toContain('cdec.water.ca.gov')
  })
})

// ---------------------------------------------------------------------------
// SENSOR_MAP completeness
// ---------------------------------------------------------------------------
describe('SENSOR_MAP', () => {
  it('defines the four expected Sierra sensors', () => {
    expect(SENSOR_MAP['3'].parameter).toBe('swe')
    expect(SENSOR_MAP['18'].parameter).toBe('snow_depth')
    expect(SENSOR_MAP['2'].parameter).toBe('precip_accum')
    expect(SENSOR_MAP['30'].parameter).toBe('temp_air')
  })

  it('all entries have a unit', () => {
    for (const entry of Object.values(SENSOR_MAP)) {
      expect(entry.unit).toBeTruthy()
    }
  })
})
