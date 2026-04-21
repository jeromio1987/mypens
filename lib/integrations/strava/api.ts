import { getValidAccessToken } from './oauth'

const STRAVA_API = 'https://www.strava.com/api/v3'

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string       // ISO timestamp
  start_date_local: string // ISO timestamp in athlete's local time
  distance: number         // meters
  moving_time: number      // seconds
  elapsed_time: number     // seconds
  total_elevation_gain: number
  average_heartrate?: number
  max_heartrate?: number
  calories?: number
  description?: string
}

async function stravaFetch(path: string, init?: RequestInit): Promise<Response> {
  const { accessToken } = await getValidAccessToken()
  const res = await fetch(`${STRAVA_API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return res
}

/** Fetch recent activities (last `days` days, default 30). */
export async function listRecentActivities(days = 30): Promise<StravaActivity[]> {
  const after = Math.floor((Date.now() - days * 86_400_000) / 1000)
  const all: StravaActivity[] = []
  let page = 1
  // Cap at 5 pages (500 activities) for safety
  while (page <= 5) {
    const res = await stravaFetch(`/athlete/activities?after=${after}&per_page=100&page=${page}`)
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 401) throw new Error('STRAVA_UNAUTHORIZED')
      if (res.status === 429) throw new Error('STRAVA_RATE_LIMITED')
      throw new Error(`Strava API error: ${res.status} ${text}`)
    }
    const batch = (await res.json()) as StravaActivity[]
    all.push(...batch)
    if (batch.length < 100) break
    page++
  }
  return all
}
