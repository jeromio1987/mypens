import { prisma } from '@/lib/db'
import { getActivity, listRecentActivities } from './api'
import { mapActivityToDraft } from './mapping'
import { importDrafts } from '@/lib/integrations/_shared/import'

/** Auto-import the last `days` days of activities. Used by both webhook
 * fallbacks and the daily cron. Updates lastSyncAt / lastError on the
 * connection row. */
export async function syncRecentActivities(days = 7): Promise<{
  created: number
  skipped: number
}> {
  try {
    const activities = await listRecentActivities(days)
    const drafts = activities.map(mapActivityToDraft)
    const result = await importDrafts('strava', drafts)
    await prisma.stravaConnection.updateMany({
      where: { userId: 'default' },
      data: { lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    await prisma.stravaConnection.updateMany({
      where: { userId: 'default' },
      data: { lastError: msg, lastErrorAt: new Date() },
    })
    throw err
  }
}

/** Fetch a single activity by id and import it (used by webhook create/update). */
export async function syncSingleActivity(activityId: string | number): Promise<{
  created: number
  skipped: number
}> {
  try {
    const a = await getActivity(activityId)
    const draft = mapActivityToDraft(a)
    const result = await importDrafts('strava', [draft])
    await prisma.stravaConnection.updateMany({
      where: { userId: 'default' },
      data: { lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    await prisma.stravaConnection.updateMany({
      where: { userId: 'default' },
      data: { lastError: msg, lastErrorAt: new Date() },
    })
    throw err
  }
}

/** Delete the imported TrainingEntry corresponding to a Strava activity (webhook delete). */
export async function deleteImportedActivity(activityId: string | number): Promise<number> {
  const res = await prisma.trainingEntry.deleteMany({
    where: { source: 'strava', externalId: String(activityId) },
  })
  return res.count
}
