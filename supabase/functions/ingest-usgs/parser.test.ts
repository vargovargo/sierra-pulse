import { describe, it, expect } from 'vitest'
import {
  parseUsgsResponse,
  validateUsgsRows,
  buildUsgsUrl,
  PARAM_MAP,
} from './parser'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTimeSeries(opts: {
  siteCode: string
  siteName?: string
  lat?: string
  lon?: string
  paramCode: string
  values: Array<{ dateTime: string; value: string }>
}) {
  return {
    sourceInfo: {
      siteCode: [{ value: opts.siteCode }],
      siteName: opts.siteName ?? `Site ${opts.siteCode}`,
      geoLocation: {
        geogLocation: {
          latitude:  opts.lat  ?? '37.7322',
          longitude: opts.lon ?? '-119.5582',
        },
      },
    },
    variable: {
      variableCode: [{ value: opts.paramCode }],
    },
    values: [{ value: opts.values }],
  }
}

function makeUsgsJson(timeSeries: object[]) {
  return { value: { timeSeries } }
}

// ---------------------------------------------------------------------------
// parseUsgsResponse — happy path
// ---------------------------------------------------------------------------
describe('parseUsgsResponse — happy path', () => {
  it('parses a single discharge observation', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500',
        paramCode: '00060',
        values: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: '1250' }],
      }),
    ])
    const rows = parseUsgsResponse(json)
    expect(rows).toHaveLength(1)
    expect(rows[0].source_id).toBe('11264500')
    expect(rows[0].parameter).toBe('discharge')
    expect(rows[0].value).toBe(1250)
    expect(rows[0].unit).toBe('cfs')
  })

  it('parses gage height observations', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500',
        paramCode: '00065',
        values: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: '5.42' }],
      }),
    ])
    const rows = parseUsgsResponse(json)
    expect(rows[0].parameter).toBe('gage_height')
    expect(rows[0].unit).toBe('feet')
    expect(rows[0].value).toBe(5.42)
  })

  it('parses multiple observations in one timeSeries', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500',
        paramCode: '00060',
        values: [
          { dateTime: '2024-04-01T10:00:00.000-07:00', value: '1100' },
          { dateTime: '2024-04-01T11:00:00.000-07:00', value: '1200' },
          { dateTime: '2024-04-01T12:00:00.000-07:00', value: '1250' },
        ],
      }),
    ])
    expect(parseUsgsResponse(json)).toHaveLength(3)
  })

  it('parses multiple stations from one response', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500', paramCode: '00060',
        values: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: '1250' }],
      }),
      makeTimeSeries({
        siteCode: '11230500', paramCode: '00060',
        values: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: '890' }],
      }),
    ])
    const rows = parseUsgsResponse(json)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.source_id)).toContain('11264500')
    expect(rows.map(r => r.source_id)).toContain('11230500')
  })

  it('extracts lat/lon from geoLocation', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500', lat: '37.7322', lon: '-119.5582',
        paramCode: '00060',
        values: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: '1000' }],
      }),
    ])
    const rows = parseUsgsResponse(json)
    expect(rows[0].lat).toBeCloseTo(37.7322)
    expect(rows[0].lon).toBeCloseTo(-119.5582)
  })

  it('preserves the dateTime string as observed_at', () => {
    const dt = '2024-04-01T12:00:00.000-07:00'
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500', paramCode: '00060',
        values: [{ dateTime: dt, value: '500' }],
      }),
    ])
    expect(parseUsgsResponse(json)[0].observed_at).toBe(dt)
  })
})

// ---------------------------------------------------------------------------
// parseUsgsResponse — nodata & edge cases
// ---------------------------------------------------------------------------
describe('parseUsgsResponse — nodata handling', () => {
  it('skips -999999 nodata sentinel', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500', paramCode: '00060',
        values: [
          { dateTime: '2024-04-01T12:00:00.000-07:00', value: '-999999' },
          { dateTime: '2024-04-01T13:00:00.000-07:00', value: '800' },
        ],
      }),
    ])
    const rows = parseUsgsResponse(json)
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBe(800)
  })

  it('skips rows where value is null', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500', paramCode: '00060',
        values: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: null as any }],
      }),
    ])
    expect(parseUsgsResponse(json)).toHaveLength(0)
  })

  it('skips non-numeric value strings', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500', paramCode: '00060',
        values: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: 'Ice' }],
      }),
    ])
    expect(parseUsgsResponse(json)).toHaveLength(0)
  })

  it('skips timeSeries with unknown parameter code', () => {
    const json = makeUsgsJson([
      makeTimeSeries({
        siteCode: '11264500', paramCode: '99999',
        values: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: '500' }],
      }),
    ])
    expect(parseUsgsResponse(json)).toHaveLength(0)
  })

  it('handles missing geoLocation gracefully (lat/lon = null)', () => {
    const json = {
      value: {
        timeSeries: [{
          sourceInfo: {
            siteCode: [{ value: '11264500' }],
            siteName: 'Test',
            // no geoLocation
          },
          variable: { variableCode: [{ value: '00060' }] },
          values: [{ value: [{ dateTime: '2024-04-01T12:00:00.000-07:00', value: '500' }] }],
        }],
      },
    }
    const rows = parseUsgsResponse(json)
    expect(rows).toHaveLength(1)
    expect(rows[0].lat).toBeNull()
    expect(rows[0].lon).toBeNull()
  })

  it('returns empty array for missing timeSeries', () => {
    expect(parseUsgsResponse({ value: {} })).toHaveLength(0)
  })

  it('returns empty array for empty timeSeries array', () => {
    expect(parseUsgsResponse(makeUsgsJson([]))).toHaveLength(0)
  })

  it('returns empty array for null input', () => {
    expect(parseUsgsResponse(null)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// validateUsgsRows
// ---------------------------------------------------------------------------
describe('validateUsgsRows', () => {
  const makeRow = (parameter: string, value: number) => ({
    source_id: '11264500', name: 'Test', lat: null, lon: null,
    observed_at: '2024-04-01T12:00:00.000-07:00',
    parameter, value, unit: parameter === 'discharge' ? 'cfs' : 'feet',
  })

  it('returns no warnings for normal discharge', () => {
    expect(validateUsgsRows([makeRow('discharge', 1250)])).toHaveLength(0)
  })

  it('returns no warnings for zero discharge (dry season)', () => {
    expect(validateUsgsRows([makeRow('discharge', 0)])).toHaveLength(0)
  })

  it('flags negative discharge', () => {
    const warnings = validateUsgsRows([makeRow('discharge', -5)])
    expect(warnings).toHaveLength(1)
    expect(warnings[0].parameter).toBe('discharge')
  })

  it('flags discharge above 1,000,000 cfs', () => {
    const warnings = validateUsgsRows([makeRow('discharge', 1_500_000)])
    expect(warnings).toHaveLength(1)
  })

  it('flags gage height above 100 feet', () => {
    const warnings = validateUsgsRows([makeRow('gage_height', 150)])
    expect(warnings).toHaveLength(1)
  })

  it('flags gage height below -5 feet', () => {
    const warnings = validateUsgsRows([makeRow('gage_height', -10)])
    expect(warnings).toHaveLength(1)
  })

  it('returns no warnings for unknown parameter', () => {
    expect(validateUsgsRows([makeRow('unknown', 9999)])).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// buildUsgsUrl
// ---------------------------------------------------------------------------
describe('buildUsgsUrl', () => {
  it('includes comma-separated site IDs', () => {
    const url = buildUsgsUrl(['11264500', '11230500'])
    expect(url).toContain('11264500%2C11230500')
  })

  it('requests discharge and gage height parameters', () => {
    const url = buildUsgsUrl(['11264500'])
    expect(url).toContain('00060')
    expect(url).toContain('00065')
  })

  it('requests JSON format', () => {
    expect(buildUsgsUrl(['11264500'])).toContain('format=json')
  })

  it('requests 2-day period', () => {
    expect(buildUsgsUrl(['11264500'])).toContain('period=P2D')
  })

  it('points to waterservices.usgs.gov', () => {
    expect(buildUsgsUrl(['11264500'])).toContain('waterservices.usgs.gov')
  })
})

// ---------------------------------------------------------------------------
// PARAM_MAP completeness
// ---------------------------------------------------------------------------
describe('PARAM_MAP', () => {
  it('defines discharge for code 00060', () => {
    expect(PARAM_MAP['00060'].parameter).toBe('discharge')
    expect(PARAM_MAP['00060'].unit).toBe('cfs')
  })

  it('defines gage_height for code 00065', () => {
    expect(PARAM_MAP['00065'].parameter).toBe('gage_height')
    expect(PARAM_MAP['00065'].unit).toBe('feet')
  })
})
