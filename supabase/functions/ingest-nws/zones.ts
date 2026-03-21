/**
 * NWS forecast zone codes covering the Eastern Sierra / Bishop area.
 * Used to filter active alerts from api.weather.gov.
 *
 * https://api.weather.gov/alerts/active?zone=CAZ081,...
 */
export const SIERRA_NWS_ZONES = [
  'CAZ081', // Southern Owens Valley
  'CAZ080', // Northern Owens Valley
  'CAZ082', // Eastern Inyo / Inyo Mountains
  'CAZ064', // Southern Sierra Nevada (above 7000 ft)
  'CAZ065', // Northern Sierra Nevada (above 7000 ft)
  'CAZ295', // White and Inyo Mountains (above 10000 ft)
  'CAZ296', // Sierra Nevada, Mono County (above 7000 ft)
]

/**
 * NWS severity → alert_category mapping.
 * Extreme / Severe → 'danger' (blocks strike window)
 * Moderate         → 'caution' (caps score at 60)
 * Minor / Unknown  → 'info'   (no score impact)
 */
export function nwsSeverityToCategory(severity: string): 'danger' | 'caution' | 'info' {
  switch (severity) {
    case 'Extreme':
    case 'Severe':  return 'danger'
    case 'Moderate': return 'caution'
    default:         return 'info'
  }
}
