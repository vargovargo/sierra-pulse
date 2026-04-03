/**
 * Eastern Sierra trailhead zones for Strava segment discovery.
 * Bounds format: [sw_lat, sw_lng, ne_lat, ne_lng]
 * Ordered north to south.
 */
export interface Zone {
  name:   string
  bounds: [number, number, number, number]
}

export const ZONES: Zone[] = [
  // --- Bishop area (active) ---
  { name: 'North Lake / Piute Pass',          bounds: [37.20, -118.72, 37.35, -118.50] },
  { name: 'Lake Sabrina',                     bounds: [37.18, -118.65, 37.26, -118.52] },
  { name: 'South Lake / Bishop Pass',         bounds: [37.10, -118.65, 37.22, -118.48] },
  { name: 'Big Pine Creek',                   bounds: [37.05, -118.53, 37.15, -118.32] },
  { name: 'Pine Creek',                       bounds: [37.32, -118.78, 37.45, -118.60] },
  { name: 'Rock Creek / Little Lakes Valley', bounds: [37.40, -118.78, 37.55, -118.58] },

  // --- Hoover Wilderness / Tioga area ---
  { name: 'Twin Lakes / Matterhorn',         bounds: [38.15, -119.42, 38.30, -119.28] },
  { name: 'Saddlebag Lake',                  bounds: [37.93, -119.32, 38.02, -119.22] },
  // { name: 'Kearsarge Pass / Onion Valley', bounds: [36.73, -118.42, 36.85, -118.25] },
  // { name: 'Shepherd Pass',                 bounds: [36.63, -118.35, 36.75, -118.20] },
  // { name: 'Whitney Portal',                bounds: [36.55, -118.32, 36.67, -118.18] },
  // { name: 'Horseshoe Meadow / Cottonwood', bounds: [36.47, -118.25, 36.58, -118.10] },
]
