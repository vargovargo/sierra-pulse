/**
 * Frontend zone configuration — mirrors supabase/functions/compute-strike-windows/zone_config.ts
 * Bounds format: [sw_lat, sw_lng, ne_lat, ne_lng]
 */
export const ZONES = [
  {
    name:   'North Lake / Piute Pass',
    bounds: [37.20, -118.72, 37.35, -118.50],
  },
  {
    name:   'Lake Sabrina',
    bounds: [37.18, -118.65, 37.26, -118.52],
  },
  {
    name:   'South Lake / Bishop Pass',
    bounds: [37.10, -118.65, 37.22, -118.48],
  },
  {
    name:   'Big Pine Creek',
    bounds: [37.05, -118.53, 37.15, -118.32],
  },
  {
    name:   'Pine Creek',
    bounds: [37.32, -118.78, 37.45, -118.60],
  },
  {
    name:   'Rock Creek / Little Lakes Valley',
    bounds: [37.40, -118.78, 37.55, -118.58],
  },
]

/**
 * Permit trailhead entry points with known coordinates.
 * Coordinates sourced from topo maps / Recreation.gov.
 */
export const TRAILHEADS = [
  { id: '456', name: 'Piute Pass',               zone: 'North Lake / Piute Pass',        lat: 37.2340, lon: -118.6000 },
  { id: '492', name: 'Lamarck Lakes',             zone: 'North Lake / Piute Pass',        lat: 37.2248, lon: -118.5972 },
  { id: '459', name: 'Bishop Pass',               zone: 'South Lake / Bishop Pass',       lat: 37.1678, lon: -118.5724 },
  { id: '192', name: 'Lake Sabrina',              zone: 'Lake Sabrina',                   lat: 37.2198, lon: -118.6098 },
  { id: '461', name: 'Big Pine Creek South Fork', zone: 'Big Pine Creek',                 lat: 37.1368, lon: -118.4390 },
  { id: '495', name: 'Big Pine Creek North Fork', zone: 'Big Pine Creek',                 lat: 37.1312, lon: -118.4391 },
  { id: '481', name: 'Pine Creek',                zone: 'Pine Creek',                     lat: 37.3845, lon: -118.7047 },
  { id: '451', name: 'Little Lakes Valley',       zone: 'Rock Creek / Little Lakes Valley', lat: 37.4352, lon: -118.7389 },
]

/** Convert a bounding box to a GeoJSON Polygon ring */
export function boundsToPolygon([sw_lat, sw_lng, ne_lat, ne_lng]) {
  return [
    [sw_lng, sw_lat],
    [ne_lng, sw_lat],
    [ne_lng, ne_lat],
    [sw_lng, ne_lat],
    [sw_lng, sw_lat],  // close ring
  ]
}

/** Build a GeoJSON FeatureCollection of zone polygons, optionally colored by status */
export function buildZoneGeojson(windows = []) {
  const statusMap = {}
  for (const w of windows) statusMap[w.zone] = w

  return {
    type: 'FeatureCollection',
    features: ZONES.map(z => {
      const w = statusMap[z.name]
      return {
        type: 'Feature',
        properties: {
          name:   z.name,
          status: w?.window_status ?? 'unknown',
          score:  w?.score ?? null,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [boundsToPolygon(z.bounds)],
        },
      }
    }),
  }
}
