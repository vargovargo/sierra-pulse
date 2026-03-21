/**
 * Caltrans LCS (Lane Closure System) chain-control and closure mapping.
 *
 * Fetches JSON feeds for Sierra Nevada districts:
 *   D3  — Northern Sierra (I-80/Donner, US-50/Echo Summit, SR-89)
 *   D6  — Central Sierra (SR-120/Tioga, SR-41, SR-140)
 *   D9  — Eastern Sierra (US-395, SR-168)
 *   D10 — Central Mother Lode (SR-88/Carson, SR-4/Ebbetts, SR-108/Sonora)
 *
 * Feed URL pattern: https://cwwp2.dot.ca.gov/data/d{N}/lcs/lcsStatusD{NN}.json
 * Auth: none (public feed)
 */

export const SIERRA_DISTRICTS = [
  { id: 3,  label: 'D3'  },
  { id: 6,  label: 'D6'  },
  { id: 9,  label: 'D9'  },
  { id: 10, label: 'D10' },
]

// Sierra Nevada routes worth surfacing to backcountry travelers
const SIERRA_ROUTES = new Set([
  '1', '4', '41', '49', '50', '80', '88', '89', '108', '120', '140', '168',
  '190', '203', '395', '58',
])

export type AlertCategory = 'closure' | 'caution' | 'info'

function lcsUrl(districtId: number): string {
  const nn = String(districtId).padStart(2, '0')
  return `https://cwwp2.dot.ca.gov/data/d${districtId}/lcs/lcsStatusD${nn}.json`
}

/** Map a chain-control status code to an alert category. */
function ccStatusToCategory(status: string): AlertCategory {
  const s = (status ?? '').toUpperCase()
  if (s.startsWith('R3') || s === 'CLOSED') return 'closure'
  if (s.startsWith('R1') || s.startsWith('R2')) return 'caution'
  return 'info'
}

/** Normalize a route string to just the number (e.g. "SR-120" → "120"). */
function normalizeRoute(raw: string): string {
  return String(raw ?? '').replace(/[^0-9]/g, '')
}

export interface RoadAlertRow {
  source:         'caltrans'
  source_id:      string
  title:          string
  description:    string | null
  category:       AlertCategory
  park_or_forest: string
  published_at:   string
  expires_at:     string | null
}

/**
 * Parse a single Caltrans LCS district JSON response into alert rows.
 * Tolerant of structural variation — logs unknown shapes, skips them.
 */
export function parseLcsDistrict(json: unknown, districtLabel: string): RoadAlertRow[] {
  const data = (json as any)?.data
  if (!data) {
    console.warn(`[roads] ${districtLabel}: no "data" key in response`)
    return []
  }

  const events: any[] = [
    ...(Array.isArray(data.chain_control) ? data.chain_control : []),
    ...(Array.isArray(data.lane_closure)  ? data.lane_closure  : []),
  ]

  const rows: RoadAlertRow[] = []

  for (const event of events) {
    const loc    = event?.location ?? {}
    const status = event?.status   ?? {}
    const timing = event?.event    ?? {}

    const route = normalizeRoute(loc.route ?? loc.routeName ?? '')
    if (!SIERRA_ROUTES.has(route)) continue

    const locationName = loc.locationName ?? loc.description ?? `SR-${route}`
    const statusDesc   = status.description ?? status.ccStatus ?? ''
    const category     = ccStatusToCategory(status.ccStatus ?? status.type ?? '')

    // Build a stable source_id from district + route + begin postmile
    const pm       = loc.beginPostmile ?? loc.postMile ?? '0'
    const sourceId = `caltrans-${districtLabel}-${route}-${pm}`

    const title       = `${locationName}: ${statusDesc || category.toUpperCase()}`
    const publishedAt = timing.startTime
      ? new Date(timing.startTime).toISOString()
      : new Date().toISOString()
    const expiresAt   = timing.endTime
      ? new Date(timing.endTime).toISOString()
      : null

    rows.push({
      source:         'caltrans',
      source_id:      sourceId,
      title:          title.slice(0, 500),
      description:    statusDesc || null,
      category,
      park_or_forest: `SR-${route} / Caltrans ${districtLabel}`,
      published_at:   publishedAt,
      expires_at:     expiresAt,
    })
  }

  return rows
}

export { lcsUrl }
