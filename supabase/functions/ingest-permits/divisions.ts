/**
 * Inyo National Forest wilderness permit facility and division IDs.
 * Facility 233262 covers all Bishop-area trailheads via one API call.
 */
export const INYO_FACILITY_ID = '233262'

export interface Division {
  id:       string
  name:     string
  zone:     string   // matches zone names in ingest-strava/zones.ts
}

export const DIVISIONS: Division[] = [
  // North Lake area
  { id: '456', name: 'Piute Pass',    zone: 'North Lake / Piute Pass' },
  { id: '492', name: 'Lamarck Lakes', zone: 'North Lake / Piute Pass' },

  // South Lake area
  { id: '459', name: 'Bishop Pass',   zone: 'South Lake / Bishop Pass' },

  // Lake Sabrina
  { id: '192', name: 'Lake Sabrina',  zone: 'Lake Sabrina' },

  // Big Pine Creek
  { id: '461', name: 'Big Pine Creek South Fork', zone: 'Big Pine Creek' },
  { id: '495', name: 'Big Pine Creek North Fork', zone: 'Big Pine Creek' },

  // Pine Creek
  { id: '481', name: 'Pine Creek',    zone: 'Pine Creek' },

  // Rock Creek / Little Lakes Valley
  { id: '451', name: 'Little Lakes Valley', zone: 'Rock Creek / Little Lakes Valley' },
]
