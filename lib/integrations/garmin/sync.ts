import { prisma } from '@/lib/db'
import { listRecentActivities, type GarminActivity } from './api'
import { mapActivityToDraft } from './mapping'
import { importDrafts } from '@/lib/integrations/_shared/import'

/**
 * Auto-import the last `days` days of Garmin activities. Used by both the
 * webhook fallback path and the daily cron. Updates lastSyncAt / lastError on
 * the connection row so the UI can surface failures.
 */
export async function syncRecentActivities(days = 7): Promise<{
  created: number
  skipped: number
}> {
  try {
    const activities = await listRecentActivities(days)
    const drafts = activities.map(mapActivityToDraft)
    const result = await importDrafts('garmin', drafts)
    await prisma.garminConnection.updateMany({
      where: { userId: 'default' },
      data: { lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    await prisma.garminConnection.updateMany({
      where: { userId: 'default' },
      data: { lastError: msg, lastErrorAt: new Date() },
    })
    throw err
  }
}

/**
 * Import a list of Garmin activity payloads delivered by the Push (Activity)
 * webhook. Garmin's Push API sends the full activity summary in the body, so
 * we can map directly without an extra fetch. Updates lastSyncAt / lastError.
 */
export async function importPushedActivities(activities: GarminActivity[]): Promise<{
  created: number
  skipped: number
}> {
  try {
    const drafts = activities.map(mapActivityToDraft)
    const result = await importDrafts('garmin', drafts)
    await prisma.garminConnection.updateMany({
      where: { userId: 'default' },
      data: { lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    await prisma.garminConnection.updateMany({
      where: { userId: 'default' },
      data: { lastError: msg, lastErrorAt: new Date() },
    })
    throw err
  }
}

/** Fetch a Garmin activity payload from a `callbackURL` provided by a PING
 * notification. Returns the parsed activities array (Garmin returns the same
 * `{ activities: [...] }` envelope as the push body). */
export async function fetchPingActivities(callbackUrl: string, accessToken: string): Promise<GarminActivity[]> {
  const res = await fetch(callbackUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin ping fetch failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as { activities?: GarminActivity[] } | GarminActivity[]
  if (Array.isArray(data)) return data
  return data.activities ?? []
}
