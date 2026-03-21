/**
 * Zone configuration for the strike window engine.
 * Maps each active Bishop-area zone to its data sources.
 *
 * cdec_source_ids   — CDEC station IDs to check for SWE; first one with data wins
 * permit_div_ids    — Recreation.gov division IDs from ingest-permits/divisions.ts
 * aqi_source_id     — AirNow station source_id (all Bishop zones share 'BISHOP')
 * bounds            — [sw_lat, sw_lng, ne_lat, ne_lng] — matches ingest-strava/zones.ts
 *                     Used to spatially filter Strava trail_segment stations.
 */
export interface ZoneConfig {
  name:             string
  cdec_source_ids:  string[]
  permit_div_ids:   string[]
  aqi_source_id:    string
  bounds:           [number, number, number, number]
}

export const ZONE_CONFIGS: ZoneConfig[] = [
  {
    name:            'North Lake / Piute Pass',
    cdec_source_ids: ['SLK', 'LON', 'GRZ'],
    permit_div_ids:  ['456', '492'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.20, -118.72, 37.35, -118.50],
  },
  {
    name:            'Lake Sabrina',
    cdec_source_ids: ['SLK', 'LON', 'GRZ'],
    permit_div_ids:  ['192'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.18, -118.65, 37.26, -118.52],
  },
  {
    name:            'South Lake / Bishop Pass',
    cdec_source_ids: ['BSH', 'SLK', 'LON'],  // BSH = Bishop Pass (confirmed live)
    permit_div_ids:  ['459'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.10, -118.65, 37.22, -118.48],
  },
  {
    name:            'Big Pine Creek',
    cdec_source_ids: ['GRZ', 'LON', 'TRS'],
    permit_div_ids:  ['461', '495'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.05, -118.53, 37.15, -118.32],
  },
  {
    name:            'Pine Creek',
    cdec_source_ids: ['RCK', 'GRZ', 'LON'],  // RCK = Rock Creek Lakes (confirmed live, nearest)
    permit_div_ids:  ['481'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.32, -118.78, 37.45, -118.60],
  },
  {
    name:            'Rock Creek / Little Lakes Valley',
    cdec_source_ids: ['RCK', 'GRZ', 'LON'],  // RCK = Rock Creek Lakes (confirmed live)
    permit_div_ids:  ['451'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.40, -118.78, 37.55, -118.58],
  },
]
