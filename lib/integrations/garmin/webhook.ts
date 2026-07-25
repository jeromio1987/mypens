import { prisma } from '@/lib/db'
import { getValidAccessToken } from './oauth'

const GARMIN_BACKFILL_BASE = 'https://apis.garmin.com/wellness-api/rest/backfill'

const BACKFILL_PATHS = ['activities', 'dailies', 'bodyComps', 'sleeps'] as const

/**
 * Trigger Garmin Backfill requests for the connected user. Garmin's Backfill
 * API asynchronously POSTs historical summaries to our registered push
 * endpoints (one summary per item), letting us seed the log with prior data
 * right after OAuth.
 *
 * Garmin requires the backfill window be ≤ 90 days; we default to 30. The
 * call is fire-and-forget — Garmin returns 202 Accepted, the actual data
 * arrives via the push webhook over the following minutes.
 */
export async function requestBackfill(days = 30): Promise<void> {
  const { accessToken } = await getValidAccessToken()
  const end = Math.floor(Date.now() / 1000)
  const start = end - Math.max(1, Math.min(90, days)) * 86_400
  const qs = `summaryStartTimeInSeconds=${start}&summaryEndTimeInSeconds=${end}`

  const errors: string[] = []
  for (const path of BACKFILL_PATHS) {
    const url = `${GARMIN_BACKFILL_BASE}/${path}?${qs}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // 202 Accepted. 409 = backfill already in flight for this window.
    // 403/404 can mean the API section isn't enabled on the app — skip those
    // so ACTIVITY_EXPORT-only apps still succeed.
    if (!res.ok && res.status !== 202 && res.status !== 409) {
      const text = await res.text()
      if (res.status === 403 || res.status === 404) {
        console.warn(`[garmin backfill] ${path} skipped: ${res.status} ${text}`)
        continue
      }
      errors.push(`${path}: ${res.status} ${text}`)
    }
  }
  if (errors.length > 0) {
    throw new Error(`Garmin backfill failed: ${errors.join('; ')}`)
  }
}

/**
 * Best-effort: kick off the initial backfill and mark the connection as
 * subscribed to push. Garmin's Push (Activity Ping Service) is configured
 * app-level in the developer portal — there is no per-user subscribe call —
 * so "subscription" here just means we've successfully requested the seed
 * backfill and any future summaries will arrive via the configured push URL.
 *
 * Errors are persisted to GarminConnection.lastError but never thrown, so a
 * backfill failure can't break the OAuth flow.
 */
export async function ensurePushSubscription(): Promise<{ subscribed: boolean }> {
  try {
    await requestBackfill(30)
    await prisma.garminConnection.updateMany({
      where: { userId: 'default' },
      data: {
        pingSubscribed: true,
        lastError: null,
        lastErrorAt: null,
      },
    })
    return { subscribed: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'backfill request failed'
    await prisma.garminConnection.updateMany({
      where: { userId: 'default' },
      data: { lastError: msg, lastErrorAt: new Date() },
    })
    return { subscribed: false }
  }
}
