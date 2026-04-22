import { prisma } from '@/lib/db'

/**
 * Retention window (in days) for `SkippedPushedWorkout` tombstones. Skips
 * older than this are dropped: the companion app's sync window only looks
 * back ~30 days for HealthKit / Health Connect, so the phone will never
 * re-push a workout with the same `externalId` after this point — keeping
 * the tombstone forever just bloats the "Show skipped" list and slows the
 * integrations page.
 *
 * The default (90 days) is comfortably larger than the companion's lookback,
 * so a tombstone is only ever cleaned up once a re-ingest is impossible.
 *
 * Override via the SKIPPED_TOMBSTONE_RETENTION_DAYS environment variable
 * (positive, finite number; otherwise the default applies).
 */
export const DEFAULT_SKIPPED_TOMBSTONE_RETENTION_DAYS = 90

export function getSkippedTombstoneRetentionDays(): number {
  const raw = process.env.SKIPPED_TOMBSTONE_RETENTION_DAYS
  if (!raw) return DEFAULT_SKIPPED_TOMBSTONE_RETENTION_DAYS
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SKIPPED_TOMBSTONE_RETENTION_DAYS
  return n
}

/**
 * Delete `SkippedPushedWorkout` rows whose `skippedAt` is older than the
 * configured retention window. Safe to call from a cron job or as a
 * fire-and-forget on-read cleanup before serving the "Show skipped" list.
 *
 * Optionally scope by `source` (e.g. only clean healthkit tombstones when
 * the healthkit activities endpoint is queried).
 */
export async function cleanupExpiredSkippedTombstones(opts?: {
  source?: string
  retentionDays?: number
  now?: Date
}): Promise<{ deleted: number; cutoff: Date; retentionDays: number }> {
  const retentionDays = opts?.retentionDays ?? getSkippedTombstoneRetentionDays()
  const now = opts?.now ?? new Date()
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 3_600_000)
  const result = await prisma.skippedPushedWorkout.deleteMany({
    where: {
      skippedAt: { lt: cutoff },
      ...(opts?.source ? { source: opts.source } : {}),
    },
  })
  return { deleted: result.count, cutoff, retentionDays }
}
