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

/**
 * Hosts we are willing to send the Garmin bearer token to. Garmin PING
 * payloads are unauthenticated (we only check that `userId` matches our
 * stored connection), so a forged webhook could otherwise smuggle a
 * `callbackURL` pointing at an attacker host and exfiltrate the token.
 * Allowlist by exact suffix match on `.garmin.com`.
 */
const GARMIN_HOST_SUFFIX = '.garmin.com'

function isAllowedGarminCallback(rawUrl: string): boolean {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  return host === 'garmin.com' || host.endsWith(GARMIN_HOST_SUFFIX)
}

/** Fetch a Garmin payload from a `callbackURL` provided by a PING notification. */
export async function fetchPingPayload<T>(
  callbackUrl: string,
  accessToken: string,
  key?: string,
): Promise<T[]> {
  if (!isAllowedGarminCallback(callbackUrl)) {
    throw new Error(`Garmin ping callbackURL rejected (not on garmin.com): ${callbackUrl}`)
  }
  const res = await fetch(callbackUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: 'error', // never follow a redirect off the allowlisted host
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin ping fetch failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as Record<string, T[]> | T[]
  if (Array.isArray(data)) return data
  if (key && Array.isArray(data[key])) return data[key]
  // Fall back to the first array value in the envelope.
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) return value
  }
  return []
}

/** Fetch a Garmin activity payload from a `callbackURL` provided by a PING
 * notification. Returns the parsed activities array (Garmin returns the same
 * `{ activities: [...] }` envelope as the push body). */
export async function fetchPingActivities(callbackUrl: string, accessToken: string): Promise<GarminActivity[]> {
  return fetchPingPayload<GarminActivity>(callbackUrl, accessToken, 'activities')
}
