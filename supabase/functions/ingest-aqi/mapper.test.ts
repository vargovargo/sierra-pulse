/**
 * Unit tests for AirNow mapper — pure logic, no Deno or network.
 * Run: npx vitest supabase/functions/ingest-aqi/mapper.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  mapAqiCategory,
  aqiStrikeStatus,
  parseAirNowResponse,
  validateAirNowRows,
  type AirNowApiRecord,
} from './mapper'

// ---------------------------------------------------------------------------
// mapAqiCategory
// ---------------------------------------------------------------------------
describe('mapAqiCategory', () => {
  it('returns good for AQI 0', ()    => expect(mapAqiCategory(0)).toBe('good'))
  it('returns good for AQI 50', ()   => expect(mapAqiCategory(50)).toBe('good'))
  it('returns moderate for AQI 51', () => expect(mapAqiCategory(51)).toBe('moderate'))
  it('returns moderate for AQI 100', () => expect(mapAqiCategory(100)).toBe('moderate'))
  it('returns unhealthy-sensitive for AQI 101', () => expect(mapAqiCategory(101)).toBe('unhealthy-sensitive'))
  it('returns unhealthy-sensitive for AQI 150', () => expect(mapAqiCategory(150)).toBe('unhealthy-sensitive'))
  it('returns unhealthy for AQI 151', () => expect(mapAqiCategory(151)).toBe('unhealthy'))
  it('returns unhealthy for AQI 200', () => expect(mapAqiCategory(200)).toBe('unhealthy'))
  it('returns hazardous for AQI 201', () => expect(mapAqiCategory(201)).toBe('hazardous'))
  it('returns hazardous for AQI 500', () => expect(mapAqiCategory(500)).toBe('hazardous'))
})

// ---------------------------------------------------------------------------
// aqiStrikeStatus
// ---------------------------------------------------------------------------
describe('aqiStrikeStatus', () => {
  it('returns clear for AQI 0',    () => expect(aqiStrikeStatus(0)).toBe('clear'))
  it('returns clear for AQI 100',  () => expect(aqiStrikeStatus(100)).toBe('clear'))
  it('returns caution for AQI 101', () => expect(aqiStrikeStatus(101)).toBe('caution'))
  it('returns caution for AQI 150', () => expect(aqiStrikeStatus(150)).toBe('caution'))
  it('returns blocked for AQI 151', () => expect(aqiStrikeStatus(151)).toBe('blocked'))
  it('returns blocked for AQI 300', () => expect(aqiStrikeStatus(300)).toBe('blocked'))
})

// ---------------------------------------------------------------------------
// parseAirNowResponse
// ---------------------------------------------------------------------------
const makeRecord = (overrides: Partial<AirNowApiRecord> = {}): AirNowApiRecord => ({
  DateObserved:  '2026-03-14 ',
  HourObserved:  12,
  LocalTimeZone: 'PST',
  ReportingArea: 'Bishop',
  StateCode:     'CA',
  Latitude:      37.363,
  Longitude:     -118.395,
  ParameterName: 'PM2.5',
  AQI:           42,
  Category:      { Number: 1, Name: 'Good' },
  ...overrides,
})

describe('parseAirNowResponse', () => {
  it('returns empty array for non-array input', () => {
    expect(parseAirNowResponse(null)).toEqual([])
    expect(parseAirNowResponse({})).toEqual([])
    expect(parseAirNowResponse('bad')).toEqual([])
  })

  it('parses a PM2.5 record into aqi + pm25 rows', () => {
    const rows = parseAirNowResponse([makeRecord()])
    expect(rows).toHaveLength(2)
    const params = rows.map(r => r.parameter).sort()
    expect(params).toEqual(['aqi', 'pm25'])
  })

  it('parses an Ozone record into aqi row only', () => {
    const rows = parseAirNowResponse([makeRecord({ ParameterName: 'Ozone' })])
    expect(rows).toHaveLength(1)
    expect(rows[0].parameter).toBe('aqi')
  })

  it('sets correct AQI value', () => {
    const rows = parseAirNowResponse([makeRecord({ AQI: 75 })])
    expect(rows.every(r => r.value === 75)).toBe(true)
  })

  it('sets correct category for good AQI', () => {
    const rows = parseAirNowResponse([makeRecord({ AQI: 42 })])
    expect(rows.every(r => r.category === 'good')).toBe(true)
  })

  it('sets correct category for unhealthy AQI', () => {
    const rows = parseAirNowResponse([makeRecord({ AQI: 175 })])
    expect(rows.every(r => r.category === 'unhealthy')).toBe(true)
  })

  it('builds correct ISO timestamp (UTC)', () => {
    const rows = parseAirNowResponse([makeRecord({ DateObserved: '2026-03-14 ', HourObserved: 9 })])
    expect(rows[0].observed_at).toBe('2026-03-14T09:00:00.000Z')
  })

  it('builds correct timestamp for midnight (hour 0, UTC)', () => {
    const rows = parseAirNowResponse([makeRecord({ HourObserved: 0 })])
    expect(rows[0].observed_at).toBe('2026-03-14T00:00:00.000Z')
  })

  it('skips records with null AQI', () => {
    const rows = parseAirNowResponse([makeRecord({ AQI: null as any })])
    expect(rows).toHaveLength(0)
  })

  it('skips records with empty DateObserved (falsy check in parser)', () => {
    // Empty string is falsy — record is skipped during parsing, not flagged by validator
    const rows = parseAirNowResponse([makeRecord({ DateObserved: '' })])
    expect(rows).toHaveLength(0)
  })

  it('handles multiple records', () => {
    const records = [
      makeRecord({ ParameterName: 'PM2.5', AQI: 30 }),
      makeRecord({ ParameterName: 'Ozone', AQI: 55 }),
    ]
    const rows = parseAirNowResponse(records)
    // PM2.5 → 2 rows; Ozone → 1 row
    expect(rows).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// validateAirNowRows
// ---------------------------------------------------------------------------
describe('validateAirNowRows', () => {
  it('returns no warnings for valid rows', () => {
    const rows = parseAirNowResponse([makeRecord({ AQI: 50 })])
    expect(validateAirNowRows(rows)).toHaveLength(0)
  })

  it('warns on AQI > 500', () => {
    const rows = parseAirNowResponse([makeRecord({ AQI: 501 })])
    const warnings = validateAirNowRows(rows)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0].message).toMatch(/out of expected range/)
  })

  it('warns on negative AQI', () => {
    const rows = parseAirNowResponse([makeRecord({ AQI: -1 })])
    const warnings = validateAirNowRows(rows)
    expect(warnings.length).toBeGreaterThan(0)
  })
})
