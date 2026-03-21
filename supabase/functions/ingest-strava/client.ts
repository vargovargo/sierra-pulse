/**
 * Strava API client for ingest-strava.
 * Handles OAuth token refresh and segment API calls.
 */

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const STRAVA_API_BASE  = 'https://www.strava.com/api/v3'

export interface StravaTokenResponse {
  access_token:  string
  refresh_token: string
  expires_at:    number
}

export interface StravaSegment {
  id:           number
  name:         string
  activity_type: string
  effort_count: number
  athlete_count: number
  start_latlng: [number, number]
  end_latlng:   [number, number]
}

export interface StravaExploreSegment {
  id:            number
  name:          string
  climb_category: number
  avg_grade:     number
  start_latlng:  [number, number]
  end_latlng:    [number, number]
  elev_difference: number
  distance:      number
}

/** Exchange refresh token for a fresh access token. */
export async function refreshAccessToken(
  clientId:     string,
  clientSecret: string,
  refreshToken: string,
): Promise<StravaTokenResponse> {
  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!resp.ok) throw new Error(`Token refresh failed: HTTP ${resp.status}`)
  return resp.json()
}

/** Discover segments in a bounding box. Returns up to 10 per Strava API limit. */
export async function exploreSegments(
  accessToken: string,
  bounds: [number, number, number, number],
  activityType: 'running' | 'riding' = 'running',
): Promise<StravaExploreSegment[]> {
  const [swLat, swLng, neLat, neLng] = bounds
  const url = `${STRAVA_API_BASE}/segments/explore` +
    `?bounds=${swLat},${swLng},${neLat},${neLng}` +
    `&activity_type=${activityType}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) throw new Error(`Explore failed: HTTP ${resp.status}`)
  const json = await resp.json()
  return json.segments ?? []
}

/** Fetch full segment details including cumulative effort_count. */
export async function fetchSegment(
  accessToken: string,
  segmentId:   number,
): Promise<StravaSegment> {
  const resp = await fetch(`${STRAVA_API_BASE}/segments/${segmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) throw new Error(`Segment ${segmentId} failed: HTTP ${resp.status}`)
  return resp.json()
}
