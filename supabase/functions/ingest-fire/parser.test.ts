import { describe, it, expect } from 'vitest'
import { rdpSimplify, mapFireFeature } from './parser.ts'

describe('rdpSimplify', () => {
  it('passes through 2-point lines unchanged', () => {
    const pts: [number, number][] = [[0, 0], [1, 1]]
    expect(rdpSimplify(pts, 0.005)).toEqual(pts)
  })

  it('removes collinear intermediate points', () => {
    // Perfectly collinear — middle point should be removed at any tolerance
    const pts: [number, number][] = [[0, 0], [0.5, 0.5], [1, 1]]
    const result = rdpSimplify(pts, 0.001)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([0, 0])
    expect(result[2 - 1]).toEqual([1, 1])
  })

  it('keeps points that deviate beyond tolerance', () => {
    // Point at (0.5, 1) deviates 0.5 from the line (0,0)→(1,0)
    const pts: [number, number][] = [[0, 0], [0.5, 0.5], [1, 0]]
    const tight   = rdpSimplify(pts, 0.001)  // should keep middle
    const relaxed = rdpSimplify(pts, 1.0)    // should remove middle
    expect(tight).toHaveLength(3)
    expect(relaxed).toHaveLength(2)
  })

  it('reduces a dense ring substantially', () => {
    // 100-point circle — expect significant reduction at 0.005° tolerance
    const pts: [number, number][] = Array.from({ length: 100 }, (_, i) => {
      const θ = (i / 100) * 2 * Math.PI
      return [Math.cos(θ), Math.sin(θ)] as [number, number]
    })
    pts.push(pts[0]) // close the ring
    const simplified = rdpSimplify(pts, 0.1)
    expect(simplified.length).toBeLessThan(pts.length * 0.5)
  })
})

describe('mapFireFeature', () => {
  const validFeature = {
    attributes: {
      IncidentName:      'TEST FIRE',
      IrwinID:           '{ABC-123}',
      GISAcres:          1500.5,
      PercentContained:  35,
      CreateDate:        1700000000000,
      FeatureCategory:   'active',
    },
    geometry: {
      rings: [
        [[-119.5, 37.5], [-119.4, 37.5], [-119.4, 37.6], [-119.5, 37.5]],
      ],
    },
  }

  it('maps a valid feature to a FireRow', () => {
    const row = mapFireFeature(validFeature)
    expect(row).not.toBeNull()
    expect(row!.fire_name).toBe('TEST FIRE')
    expect(row!.irwin_id).toBe('{ABC-123}')
    expect(row!.acres).toBeCloseTo(1500.5)
    expect(row!.containment_pct).toBe(35)
    expect(row!.status).toBe('active')
    expect((row!.geometry as any).type).toBe('Polygon')
  })

  it('returns null when IncidentName is missing', () => {
    const bad = { ...validFeature, attributes: { ...validFeature.attributes, IncidentName: null } }
    expect(mapFireFeature(bad)).toBeNull()
  })

  it('returns null when IrwinID is missing', () => {
    const bad = { ...validFeature, attributes: { ...validFeature.attributes, IrwinID: null } }
    expect(mapFireFeature(bad)).toBeNull()
  })

  it('returns null when geometry rings are absent', () => {
    const bad = { ...validFeature, geometry: { rings: [] } }
    expect(mapFireFeature(bad)).toBeNull()
  })

  it('simplifies rings with default tolerance', () => {
    // 50-point ring — should be reduced
    const bigRing = Array.from({ length: 50 }, (_, i) => {
      const θ = (i / 50) * 2 * Math.PI
      return [-119.5 + Math.cos(θ) * 0.1, 37.5 + Math.sin(θ) * 0.1]
    })
    bigRing.push(bigRing[0])
    const feat = { ...validFeature, geometry: { rings: [bigRing] } }
    const row  = mapFireFeature(feat)
    const simplified = (row!.geometry as any).coordinates[0]
    expect(simplified.length).toBeLessThan(bigRing.length)
  })
})
