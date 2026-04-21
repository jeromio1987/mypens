import { getValidAccessToken } from './oauth'

const GARMIN_API = 'https://apis.garmin.com/wellness-api/rest'

export interface GarminActivity {
  activityId: number | string
  activityName?: string
  activityType: string                    // e.g. 'STRENGTH_TRAINING', 'RUNNING'
  startTimeInSeconds: number              // unix seconds (UTC)
  startTimeOffsetInSeconds?: number       // local offset in seconds
  durationInSeconds: number
  distanceInMeters?: number
  totalElevationGainInMeters?: number
  averageHeartRateInBeatsPerMinute?: number
  maxHeartRateInBeatsPerMinute?: number
  activeKilocalories?: number
  description?: string
}

/**
 * Fetch recent Garmin activities for the connected user.
 * Garmin's wellness API exposes activity summaries via `/activities` with a
 * `uploadStartTimeInSeconds` / `uploadEndTimeInSeconds` window (max 24h per call).
 */
export async function listRecentActivities(days = 30): Promise<GarminActivity[]> {
  const { accessToken } = await getValidAccessToken()
  const now = Math.floor(Date.now() / 1000)
  const all: GarminActivity[] = []

  // Garmin requires ≤ 24h windows. Walk back day by day, capped to `days`.
  for (let i = 0; i < days; i++) {
    const end = now - i * 86_400
    const start = end - 86_400
    const url = `${GARMIN_API}/activities?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 401) throw new Error('GARMIN_UNAUTHORIZED')
      if (res.status === 429) throw new Error('GARMIN_RATE_LIMITED')
      throw new Error(`Garmin API error: ${res.status} ${text}`)
    }
    const batch = (await res.json()) as GarminActivity[]
    if (Array.isArray(batch)) all.push(...batch)
  }

  // Dedupe by activityId in case Garmin returns the same activity in adjacent windows.
  const seen = new Set<string>()
  return all.filter(a => {
    const key = String(a.activityId)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
