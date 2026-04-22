import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getMobileStaleThresholdHours } from '@/lib/integrations/staleThreshold'

/**
 * Daily scan for HealthKit / Health Connect pairings that have gone silent
 * past `MOBILE_STALE_THRESHOLD_HOURS`. When a pairing crosses the threshold
 * we drop a single in-app Notification with a link to /integrations.
 *
 * Idempotency:
 *   We notify only when (lastSyncAt, or createdAt for never-synced rows) is
 *   older than the threshold AND `lastStaleNotifiedAt` is either null or
 *   older than the latest sync timestamp. After a recovery push advances
 *   `lastSyncAt` past `lastStaleNotifiedAt`, the next stale event renotifies
 *   automatically.
 *
 *   The "claim" (stamping lastStaleNotifiedAt) is done as a conditional
 *   `updateMany` whose WHERE clause re-checks every eligibility condition.
 *   We only create the Notification if the claim affected exactly 1 row,
 *   which is what makes two overlapping cron invocations safe.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header. The query-
 *   param fallback used by some other cron endpoints is intentionally NOT
 *   accepted here to avoid leaking the secret via request logs.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

interface ConnRow {
  id: string
  userId: string
  deviceLabel: string | null
  lastSyncAt: Date | null
  lastStaleNotifiedAt: Date | null
  createdAt: Date
}

/**
 * Pure decision: would this row trigger a notification right now? Used for
 * the dry-run preview AND to short-circuit the per-row claim. The actual
 * race-safe claim happens in `tryClaim`.
 */
function isEligible(conn: ConnRow, thresholdHours: number, now: Date): boolean {
  const referenceAt = conn.lastSyncAt ?? conn.createdAt
  const hoursSilent = (now.getTime() - referenceAt.getTime()) / 3_600_000
  if (hoursSilent <= thresholdHours) return false
  if (conn.lastStaleNotifiedAt) {
    if (!conn.lastSyncAt) return false // never-synced: notify only once ever
    if (conn.lastStaleNotifiedAt >= conn.lastSyncAt) return false
  }
  return true
}

function hoursSilent(conn: ConnRow, now: Date): number {
  const referenceAt = conn.lastSyncAt ?? conn.createdAt
  return (now.getTime() - referenceAt.getTime()) / 3_600_000
}

function describeGap(hours: number): string {
  if (hours < 48) return `${Math.round(hours)} hours`
  return `${Math.round(hours / 24)} days`
}

/**
 * Atomically claim a connection row for notification: stamps
 * lastStaleNotifiedAt = now ONLY if the row is still eligible (re-checks
 * the same conditions as `isEligible` against the live row state). Returns
 * true iff this caller won the race and should create the notification.
 */
async function tryClaimHealthkit(
  connId: string,
  conn: ConnRow,
  cutoff: Date,
  now: Date,
): Promise<boolean> {
  const result = await prisma.healthkitConnection.updateMany({
    where: {
      id: connId,
      ...buildEligibilityFilter(conn, cutoff),
    },
    data: { lastStaleNotifiedAt: now },
  })
  return result.count === 1
}

async function tryClaimHealthconnect(
  connId: string,
  conn: ConnRow,
  cutoff: Date,
  now: Date,
): Promise<boolean> {
  const result = await prisma.healthConnectConnection.updateMany({
    where: {
      id: connId,
      ...buildEligibilityFilter(conn, cutoff),
    },
    data: { lastStaleNotifiedAt: now },
  })
  return result.count === 1
}

function buildEligibilityFilter(conn: ConnRow, cutoff: Date) {
  // Mirror `isEligible` as a Prisma WHERE so the DB enforces it:
  //   stale: lastSyncAt < cutoff, OR (lastSyncAt null AND createdAt < cutoff)
  //   not yet notified for this stale period:
  //     lastStaleNotifiedAt is null, OR lastStaleNotifiedAt < lastSyncAt
  // Note: the never-synced branch only matters if lastStaleNotifiedAt is null
  // (we never re-fire for never-synced rows once notified).
  if (!conn.lastSyncAt) {
    return {
      lastSyncAt: null,
      lastStaleNotifiedAt: null,
      createdAt: { lt: cutoff },
    }
  }
  return {
    lastSyncAt: { lt: cutoff },
    OR: [
      { lastStaleNotifiedAt: null },
      { lastStaleNotifiedAt: { lt: conn.lastSyncAt } },
    ],
  }
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const thresholdHours = getMobileStaleThresholdHours()
  const now = new Date()
  const cutoff = new Date(now.getTime() - thresholdHours * 3_600_000)
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'

  const [hkRows, hcRows] = await Promise.all([
    prisma.healthkitConnection.findMany({
      select: {
        id: true,
        userId: true,
        deviceLabel: true,
        lastSyncAt: true,
        lastStaleNotifiedAt: true,
        createdAt: true,
      },
    }),
    prisma.healthConnectConnection.findMany({
      select: {
        id: true,
        userId: true,
        deviceLabel: true,
        lastSyncAt: true,
        lastStaleNotifiedAt: true,
        createdAt: true,
      },
    }),
  ])

  const candidates: Array<{
    provider: 'healthkit' | 'healthconnect'
    conn: ConnRow
  }> = []
  for (const c of hkRows) {
    if (isEligible(c, thresholdHours, now)) {
      candidates.push({ provider: 'healthkit', conn: c })
    }
  }
  for (const c of hcRows) {
    if (isEligible(c, thresholdHours, now)) {
      candidates.push({ provider: 'healthconnect', conn: c })
    }
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      thresholdHours,
      candidates: candidates.map(({ provider, conn }) => ({
        provider,
        connId: conn.id,
        userId: conn.userId,
        deviceLabel: conn.deviceLabel,
        hoursSilent: hoursSilent(conn, now),
      })),
    })
  }

  const notified: Array<{
    provider: 'healthkit' | 'healthconnect'
    connId: string
    hoursSilent: number
  }> = []

  for (const { provider, conn } of candidates) {
    const claimed =
      provider === 'healthkit'
        ? await tryClaimHealthkit(conn.id, conn, cutoff, now)
        : await tryClaimHealthconnect(conn.id, conn, cutoff, now)
    if (!claimed) continue // a concurrent run beat us to it, or row recovered

    const providerName =
      provider === 'healthkit' ? 'Apple Health' : 'Health Connect'
    const device = conn.deviceLabel ?? 'your phone'
    const silent = hoursSilent(conn, now)
    const gap = describeGap(silent)

    await prisma.notification.create({
      data: {
        userId: conn.userId,
        kind: 'stale_pairing',
        title: `${providerName} hasn't checked in for ${gap}`,
        body:
          `${device} stopped pushing background data. ` +
          `Open the companion app and re-grant access to resume the sync.`,
        href: '/integrations',
      },
    })

    notified.push({
      provider,
      connId: conn.id,
      hoursSilent: Math.round(silent),
    })
  }

  return NextResponse.json({
    ok: true,
    thresholdHours,
    notified: notified.length,
    providers: notified,
  })
}

export const GET = run
export const POST = run
