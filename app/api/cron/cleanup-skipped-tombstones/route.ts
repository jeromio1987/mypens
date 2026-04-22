import { NextResponse } from 'next/server'
import {
  cleanupExpiredSkippedTombstones,
  getSkippedTombstoneRetentionDays,
} from '@/lib/integrations/_shared/skippedTombstoneRetention'

/**
 * Daily cleanup: drop `SkippedPushedWorkout` tombstones older than the
 * configured retention window (see `skippedTombstoneRetention.ts`). The
 * companion app's lookback is much shorter than this window, so an expired
 * tombstone can never be re-triggered by a re-push and only serves to bloat
 * the "Show skipped" list on the integrations page.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (header only, to avoid leaking
 * the secret via request logs — same convention as `check-stale-pairings`).
 *
 * Pass `?dryRun=1` to count expired rows without deleting them.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const retentionDays = getSkippedTombstoneRetentionDays()
  const now = new Date()
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 3_600_000)

  if (dryRun) {
    const { prisma } = await import('@/lib/db')
    const expired = await prisma.skippedPushedWorkout.count({
      where: { skippedAt: { lt: cutoff } },
    })
    return NextResponse.json({
      ok: true,
      dryRun: true,
      retentionDays,
      cutoff: cutoff.toISOString(),
      expired,
    })
  }

  const { deleted } = await cleanupExpiredSkippedTombstones({ now, retentionDays })
  return NextResponse.json({
    ok: true,
    retentionDays,
    cutoff: cutoff.toISOString(),
    deleted,
  })
}

export const GET = run
export const POST = run
