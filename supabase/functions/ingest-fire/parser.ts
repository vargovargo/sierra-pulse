/**
 * Fire perimeter parsing: RDP simplification + NIFC feature mapping.
 */

type Coordinate = [number, number]

/**
 * Ramer-Douglas-Peucker polyline simplification.
 * tolerance in degrees — 0.005° ≈ 500m at Sierra latitudes.
 * Pure recursive implementation; safe for the ring sizes NIFC returns.
 */
export function rdpSimplify(points: Coordinate[], tolerance: number): Coordinate[] {
  if (points.length <= 2) return points

  const [x1, y1] = points[0]
  const [x2, y2] = points[points.length - 1]
  const dx  = x2 - x1
  const dy  = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)

  let maxDist = 0
  let maxIdx  = 0

  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]
    const dist = len === 0
      ? Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
      : Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / len

    if (dist > maxDist) {
      maxDist = dist
      maxIdx  = i
    }
  }

  if (maxDist > tolerance) {
    const left  = rdpSimplify(points.slice(0, maxIdx + 1), tolerance)
    const right = rdpSimplify(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[points.length - 1]]
}

export interface FireRow {
  fire_name:       string
  irwin_id:        string | null
  acres:           number | null
  containment_pct: number | null
  discovered_at:   string | null
  geometry:        object   // GeoJSON Polygon
  status:          string
}

/**
 * Map a single NIFC Esri JSON feature to a fire_perimeters row.
 * Returns null if required fields are missing.
 * Simplifies each polygon ring with RDP before storing.
 */
export function mapFireFeature(feature: unknown, tolerance = 0.005): FireRow | null {
  const f     = feature as any
  const attrs = f?.attributes ?? {}
  const rings = f?.geometry?.rings as number[][][] | undefined

  if (!attrs.IncidentName || !rings?.length) return null

  // Require an IRWIN ID — fires without one can't be deduped safely
  if (!attrs.IrwinID) return null

  const coordinates = rings.map(ring =>
    rdpSimplify(ring as Coordinate[], tolerance)
  )

  return {
    fire_name:       String(attrs.IncidentName),
    irwin_id:        String(attrs.IrwinID),
    acres:           attrs.GISAcres   != null ? Number(attrs.GISAcres)   : null,
    containment_pct: attrs.PercentContained != null ? Number(attrs.PercentContained) : null,
    discovered_at:   attrs.CreateDate ? new Date(attrs.CreateDate).toISOString() : null,
    geometry:        { type: 'Polygon', coordinates },
    status:          attrs.FeatureCategory ?? 'active',
  }
}
