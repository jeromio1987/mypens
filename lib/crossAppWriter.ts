import { prisma } from '@/lib/db'
import {
  computeSleepScore,
  hrvReadinessInclusiveRolling,
  sleepScoresForNight,
  type SleepRow,
} from '@/lib/readinessMetrics'

/**
 * Refreshes `cross_app.daily_snapshot` for one calendar day from MY PENS Prisma data.
 * Safe no-op on failure (missing schema, permissions) — logs only.
 * Investing dashboard cron fills `regime` / `pnl_pct`; this writer only overwrites
 * sleep_score, hrv_readiness, weight_kg, mood, energy.
 */
export async function refreshCrossAppDailySnapshot(date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return

  try {
    const [sleep, weightRows, journal, recovery, recentSleeps, priorSleepsStrict] = await Promise.all([
      prisma.sleepEntry.findUnique({ where: { date } }),
      prisma.weightEntry.findMany({
        where: { date },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
      prisma.journalEntry.findUnique({ where: { date } }),
      prisma.recoveryEntry.findUnique({ where: { date } }),
      prisma.sleepEntry.findMany({
        orderBy: { date: 'desc' },
        take: 60,
        select: { date: true, hours: true, quality: true, hrv: true },
      }),
      prisma.sleepEntry.findMany({
        where: { date: { lt: date } },
        orderBy: { date: 'desc' },
        take: 60,
        select: { date: true, hours: true, quality: true, hrv: true },
      }),
    ])

    const recentAsRows: SleepRow[] = recentSleeps.map(e => ({
      date: e.date,
      hours: e.hours,
      quality: e.quality,
      hrv: e.hrv,
    }))
    const priorStrictRows: SleepRow[] = priorSleepsStrict.map(e => ({
      date: e.date,
      hours: e.hours,
      quality: e.quality,
      hrv: e.hrv,
    }))

    let sleepScore: number | null = null
    let hrvReadiness: number | null = null
    if (sleep) {
      const night: SleepRow = {
        date: sleep.date,
        hours: sleep.hours,
        quality: sleep.quality,
        hrv: sleep.hrv,
      }
      sleepScore = computeSleepScore(sleep.hours, sleep.quality)
      const latestNightDate = recentAsRows[0]?.date ?? null
      if (latestNightDate === sleep.date) {
        hrvReadiness = hrvReadinessInclusiveRolling(recentAsRows)
      } else {
        hrvReadiness = sleepScoresForNight(night, priorStrictRows).hrvReadiness
      }
    }

    const w = weightRows[0]
    const weightKg =
      w != null ? (Number.isFinite(w.trueWeightKg) ? w.trueWeightKg : w.scaleKg) : null

    const moodJournal = journal?.mood ?? null
    const moodRecovery = recovery?.mood ?? null
    const mood = moodJournal ?? moodRecovery ?? null
    const energy = recovery?.energy ?? null

    await prisma.$executeRaw`
      INSERT INTO cross_app.daily_snapshot (
        date, sleep_score, hrv_readiness, weight_kg, mood, energy, updated_at
      )
      VALUES (
        ${date}::date,
        ${sleepScore},
        ${hrvReadiness},
        ${weightKg},
        ${mood},
        ${energy},
        NOW()
      )
      ON CONFLICT (date) DO UPDATE SET
        sleep_score   = EXCLUDED.sleep_score,
        hrv_readiness = EXCLUDED.hrv_readiness,
        weight_kg     = EXCLUDED.weight_kg,
        mood          = EXCLUDED.mood,
        energy        = EXCLUDED.energy,
        updated_at    = EXCLUDED.updated_at
    `
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (
      msg.includes('cross_app') ||
      msg.includes('daily_snapshot') ||
      msg.includes('does not exist') ||
      msg.includes('permission denied')
    ) {
      console.warn('[crossAppWriter] snapshot skipped:', msg)
      return
    }
    console.error('[crossAppWriter]', e)
  }
}

/** Fire-and-forget refresh (never throws). */
export function scheduleCrossAppDailySnapshotRefresh(date: string): void {
  void refreshCrossAppDailySnapshot(date).catch(err =>
    console.error('[crossAppWriter] async refresh failed', err),
  )
}
