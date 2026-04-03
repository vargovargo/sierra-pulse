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
  // Hoover Wilderness
  {
    name:   'Twin Lakes / Matterhorn',
    bounds: [38.15, -119.42, 38.30, -119.28],
  },
  {
    name:   'Saddlebag Lake',
    bounds: [37.93, -119.32, 38.02, -119.22],
  },
]

/**
 * Permit trailhead entry points with known coordinates.
 * Coordinates sourced from topo maps / Recreation.gov.
 */
export const TRAILHEADS = [
  { id: '456', name: 'Piute Pass',               zone: 'North Lake / Piute Pass',        lat: 37.2266667, lon: -118.6277778 },
  { id: '497', name: 'Lamarck Lakes',             zone: 'North Lake / Piute Pass',        lat: 37.2264722, lon: -118.6273333 },
  { id: '459', name: 'Bishop Pass',               zone: 'South Lake / Bishop Pass',       lat: 37.1685278, lon: -118.5661111 },
  { id: '482', name: 'Sabrina Lake',              zone: 'Lake Sabrina',                   lat: 37.2133333, lon: -118.6091667 },
  { id: '484', name: 'George Lake',               zone: 'Lake Sabrina',                   lat: 37.2111111, lon: -118.6093333 },
  { id: '461', name: 'Big Pine Creek South Fork', zone: 'Big Pine Creek',                 lat: 37.1368, lon: -118.4390 },
  { id: '495', name: 'Big Pine Creek North Fork', zone: 'Big Pine Creek',                 lat: 37.1312, lon: -118.4391 },
  { id: '481', name: 'Pine Creek',                zone: 'Pine Creek',                     lat: 37.3845, lon: -118.7047 },
  { id: '451', name: 'Little Lakes Valley',       zone: 'Rock Creek / Little Lakes Valley', lat: 37.4352,    lon: -118.7389   },
  // Hoover Wilderness (facility 445856)
  { id: '8560', name: 'Buckeye Creek',            zone: 'Twin Lakes / Matterhorn',          lat: 38.23475,   lon: -119.351145 },
  { id: '8561', name: 'Robinson Creek',           zone: 'Twin Lakes / Matterhorn',          lat: 38.146963,  lon: -119.377661 },
  { id: '8562', name: 'Little Slide Canyon',      zone: 'Twin Lakes / Matterhorn',          lat: 38.145511,  lon: -119.416796 },
  { id: '8563', name: 'Horse Creek',              zone: 'Twin Lakes / Matterhorn',          lat: 38.145569,  lon: -119.378665 },
  { id: '8564', name: 'Green Creek',              zone: 'Twin Lakes / Matterhorn',          lat: 38.106246,  lon: -119.282177 },
  { id: '8565', name: 'Virginia Lakes',           zone: 'Saddlebag Lake',                   lat: 38.047853,  lon: -119.263006 },
]

/** Recreation.gov facility ID by trailhead division ID */
const FACILITY_BY_DIV = {
  '456': '233262', '497': '233262', '459': '233262', '482': '233262',
  '484': '233262', '461': '233262', '495': '233262', '481': '233262',
  '451': '233262',
  '8560': '445856', '8561': '445856', '8562': '445856', '8563': '445856',
  '8564': '445856', '8565': '445856',
}

export function recGovUrl(divId) {
  const facilityId = FACILITY_BY_DIV[divId] ?? '233262'
  return `https://www.recreation.gov/permits/${facilityId}`
}

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
