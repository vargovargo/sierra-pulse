import { describe, it, expect } from 'vitest'
import { parseLcsDistrict } from './mapper.ts'

const makeLcs = (overrides: object = {}) => ({
  data: {
    chain_control: [
      {
        location: {
          locationName: 'SR 120 Tioga Pass Road',
          route: '120',
          county: 'TUO',
          beginPostmile: '45.2',
        },
        status: {
          ccStatus: 'R1',
          description: 'R1-Chains Required Except 4WD w/Snow Tires',
        },
        event: {
          startTime: '2026-03-15T08:00:00',
          endTime: null,
        },
        ...overrides,
      },
    ],
  },
})

describe('parseLcsDistrict', () => {
  it('maps a chain control event to an alert row', () => {
    const rows = parseLcsDistrict(makeLcs(), 'D6')
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.source).toBe('caltrans')
    expect(row.category).toBe('caution')
    expect(row.source_id).toBe('caltrans-D6-120-45.2')
    expect(row.title).toContain('SR 120 Tioga Pass')
    expect(row.expires_at).toBeNull()
  })

  it('maps R3 to closure category', () => {
    const json = makeLcs()
    ;(json.data.chain_control[0] as any).status.ccStatus = 'R3'
    const rows = parseLcsDistrict(json, 'D6')
    expect(rows[0].category).toBe('closure')
  })

  it('filters out non-Sierra routes', () => {
    const json = makeLcs()
    ;(json.data.chain_control[0] as any).location.route = '99'
    const rows = parseLcsDistrict(json, 'D6')
    expect(rows).toHaveLength(0)
  })

  it('returns [] when data key is absent', () => {
    expect(parseLcsDistrict({}, 'D6')).toEqual([])
    expect(parseLcsDistrict(null, 'D6')).toEqual([])
  })

  it('combines chain_control and lane_closure arrays', () => {
    const json = {
      data: {
        chain_control: [makeLcs().data.chain_control[0]],
        lane_closure: [
          {
            location: { locationName: 'I-80 Donner Summit', route: '80', beginPostmile: '186' },
            status: { ccStatus: 'R2', description: 'R2-Chains or Traction Devices Required' },
            event: { startTime: '2026-03-15T10:00:00', endTime: '2026-03-15T18:00:00' },
          },
        ],
      },
    }
    const rows = parseLcsDistrict(json, 'D3')
    expect(rows).toHaveLength(2)
    const i80 = rows.find(r => r.source_id.includes('80'))!
    expect(i80.expires_at).toBeTruthy()
  })

  it('truncates very long titles to 500 chars', () => {
    const json = makeLcs()
    ;(json.data.chain_control[0] as any).location.locationName = 'A'.repeat(600)
    const rows = parseLcsDistrict(json, 'D6')
    expect(rows[0].title.length).toBeLessThanOrEqual(500)
  })
})
