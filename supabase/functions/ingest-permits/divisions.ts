/**
 * Wilderness permit facility and division IDs for Recreation.gov.
 * Each facility maps to a National Forest; divisions map to zone names
 * in ingest-strava/zones.ts.
 */

export interface Division {
  id:   string
  name: string
  zone: string
}

export interface Facility {
  id:        string
  forest:    string
  divisions: Division[]
}

// ---------------------------------------------------------------------------
// Inyo National Forest — facility 233262 (Bishop-area trailheads)
// ---------------------------------------------------------------------------
const INYO_DIVISIONS: Division[] = [
  { id: '456', name: 'Piute Pass',               zone: 'North Lake / Piute Pass' },
  { id: '497', name: 'Lamarck Lakes',             zone: 'North Lake / Piute Pass' },
  { id: '459', name: 'Bishop Pass',               zone: 'South Lake / Bishop Pass' },
  { id: '482', name: 'Sabrina Lake',              zone: 'Lake Sabrina' },
  { id: '484', name: 'George Lake',               zone: 'Lake Sabrina' },
  { id: '461', name: 'Big Pine Creek South Fork', zone: 'Big Pine Creek' },
  { id: '495', name: 'Big Pine Creek North Fork', zone: 'Big Pine Creek' },
  { id: '481', name: 'Pine Creek',                zone: 'Pine Creek' },
  { id: '451', name: 'Little Lakes Valley',       zone: 'Rock Creek / Little Lakes Valley' },
]

// ---------------------------------------------------------------------------
// Humboldt-Toiyabe National Forest — facility 445856 (Hoover Wilderness)
// ---------------------------------------------------------------------------
const HOOVER_DIVISIONS: Division[] = [
  { id: '8560', name: 'Buckeye Creek',       zone: 'Twin Lakes / Matterhorn' },
  { id: '8561', name: 'Robinson Creek',      zone: 'Twin Lakes / Matterhorn' },
  { id: '8562', name: 'Little Slide Canyon', zone: 'Twin Lakes / Matterhorn' },
  { id: '8563', name: 'Horse Creek',         zone: 'Twin Lakes / Matterhorn' },
  { id: '8564', name: 'Green Creek',         zone: 'Twin Lakes / Matterhorn' },
  { id: '8565', name: 'Virginia Lakes',      zone: 'Saddlebag Lake' },
]

// ---------------------------------------------------------------------------
// All facilities — ingest-permits loops through this list
// ---------------------------------------------------------------------------
export const FACILITIES: Facility[] = [
  { id: '233262', forest: 'Inyo National Forest',            divisions: INYO_DIVISIONS },
  { id: '445856', forest: 'Humboldt-Toiyabe National Forest', divisions: HOOVER_DIVISIONS },
]

// Legacy export — still used by existing ingest logic until refactored
export const INYO_FACILITY_ID = '233262'
export const DIVISIONS        = INYO_DIVISIONS
