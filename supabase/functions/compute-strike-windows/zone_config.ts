/**
 * Zone configuration for the strike window engine.
 * Maps each active zone to its data sources.
 *
 * cdec_source_ids   — CDEC station IDs to check for SWE; first one with data wins
 * permit_div_ids    — Recreation.gov division IDs from ingest-permits/divisions.ts
 * aqi_source_id     — AirNow station source_id
 * bounds            — [sw_lat, sw_lng, ne_lat, ne_lng] — matches ingest-strava/zones.ts
 *                     Used to spatially filter Strava trail_segment stations.
 * area              — display grouping used by the frontend (not stored in DB)
 */
export interface ZoneConfig {
  name:             string
  cdec_source_ids:  string[]
  permit_div_ids:   string[]
  aqi_source_id:    string
  bounds:           [number, number, number, number]
  area:             string
}

export const ZONE_CONFIGS: ZoneConfig[] = [
  // ---------------------------------------------------------------------------
  // Eastern Sierra — Bishop corridor
  // ---------------------------------------------------------------------------
  {
    name:            'North Lake / Piute Pass',
    cdec_source_ids: ['SLK', 'LON', 'GRZ'],
    permit_div_ids:  ['456', '497'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.20, -118.72, 37.35, -118.50],
    area:            'Eastern Sierra',
  },
  {
    name:            'Lake Sabrina',
    cdec_source_ids: ['SLK', 'LON', 'GRZ'],
    permit_div_ids:  ['482', '484'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.18, -118.65, 37.26, -118.52],
    area:            'Eastern Sierra',
  },
  {
    name:            'South Lake / Bishop Pass',
    cdec_source_ids: ['BSH', 'SLK', 'LON'],
    permit_div_ids:  ['459'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.10, -118.65, 37.22, -118.48],
    area:            'Eastern Sierra',
  },
  {
    name:            'Big Pine Creek',
    cdec_source_ids: ['GRZ', 'LON', 'TRS'],
    permit_div_ids:  ['461', '495'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.05, -118.53, 37.15, -118.32],
    area:            'Eastern Sierra',
  },
  {
    name:            'Pine Creek',
    cdec_source_ids: ['RCK', 'GRZ', 'LON'],
    permit_div_ids:  ['481'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.32, -118.78, 37.45, -118.60],
    area:            'Eastern Sierra',
  },
  {
    name:            'Rock Creek / Little Lakes Valley',
    cdec_source_ids: ['RCK', 'GRZ', 'LON'],
    permit_div_ids:  ['451'],
    aqi_source_id:   'BISHOP',
    bounds:          [37.40, -118.78, 37.55, -118.58],
    area:            'Eastern Sierra',
  },

  // ---------------------------------------------------------------------------
  // Yosemite National Park
  // ---------------------------------------------------------------------------
  {
    name:            'Tuolumne Meadows',
    cdec_source_ids: ['TUM', 'DAN'],
    permit_div_ids:  ['44585906', '44585907', '44585914', '44585915', '44585921', '44585922', '44585940', '44585945', '44585955', '44585956'],
    aqi_source_id:   'MAMMOTH',
    bounds:          [37.82, -119.55, 37.93, -119.28],
    area:            'Yosemite',
  },
  {
    name:            'Yosemite Valley',
    cdec_source_ids: ['TUM', 'DAN'],
    permit_div_ids:  ['44585912', '44585913', '44585916', '44585917', '44585918', '44585928', '44585935', '44585954'],
    aqi_source_id:   'MAMMOTH',
    bounds:          [37.70, -119.65, 37.78, -119.52],
    area:            'Yosemite',
  },

  // ---------------------------------------------------------------------------
  // Hoover Wilderness — Bridgeport / Tioga corridor
  // ---------------------------------------------------------------------------
  {
    name:            'Twin Lakes / Matterhorn',
    cdec_source_ids: ['DAN', 'TUM'],
    permit_div_ids:  ['8560', '8561', '8562', '8563', '8564'],
    aqi_source_id:   'MAMMOTH',
    bounds:          [38.15, -119.42, 38.30, -119.28],
    area:            'Hoover Wilderness',
  },
  {
    name:            'Saddlebag Lake',
    cdec_source_ids: ['DAN', 'TUM'],
    permit_div_ids:  ['8565'],
    aqi_source_id:   'MAMMOTH',
    bounds:          [37.93, -119.32, 38.02, -119.22],
    area:            'Hoover Wilderness',
  },
]
