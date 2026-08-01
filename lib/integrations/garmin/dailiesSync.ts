/**
 * Persist Garmin wellness dailies (steps + Active/Resting/Total kcal) into
 * GarminDailyMetric for Fuel NEAT + Phase C reconciliation.
 * Sleep continues to live in sleepSync — this module is additive.
 */

import { prisma } from '@/lib/db'
import { getValidAccessToken } from './oauth'

export type GarminDailyWellness = {
  calendarDate?: string
  userId?: string
  steps?: number
  activeKilocalories?: number
  bmrKilocalories?: number
  restingKilocalories?: number
  totalKilocalories?: number
  sleepingSeconds?: number
  avgSleepingHRV?: number
}

async function upsertMetric(
  date: string,
  kind: string,
  valueNum: number | null,
  unit: string | null,
  raw: string,
): Promise<'upserted' | 'skipped'> {
  if (valueNum == null || !Number.isFinite(valueNum) || valueNum < 0) return 'skipped'
  await prisma.garminDailyMetric.upsert({
    where: { date_kind: { date, kind } },
    create: {
      date,
      kind,
      valueNum,
      unit,
      raw,
      sourceFile: 'garmin_wellness_dailies',
    },
    update: {
      valueNum,
      unit,
      raw,
      sourceFile: 'garmin_wellness_dailies',
    },
  })
  return 'upserted'
}

/**
 * Write steps + calorie layers for one daily summary.
 * Kinds: steps, active_calories, resting_calories, total_calories
 * (+ legacy `calories` = total for dump/cockpit compat).
 */
export async function upsertWellnessFromDaily(
  daily: GarminDailyWellness,
): Promise<{ upserted: number; skipped: number }> {
  const date = daily.calendarDate
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { upserted: 0, skipped: 1 }
  }

  const raw = JSON.stringify(daily)
  let upserted = 0
  let skipped = 0

  const steps = daily.steps != null ? Number(daily.steps) : null
  const active =
    daily.activeKilocalories != null ? Number(daily.activeKilocalories) : null
  const resting =
    daily.bmrKilocalories != null
      ? Number(daily.bmrKilocalories)
      : daily.restingKilocalories != null
        ? Number(daily.restingKilocalories)
        : null
  let total =
    daily.totalKilocalories != null ? Number(daily.totalKilocalories) : null
  if (
    (total == null || !Number.isFinite(total)) &&
    active != null &&
    Number.isFinite(active) &&
    resting != null &&
    Number.isFinite(resting)
  ) {
    total = active + resting
  }

  const results = await Promise.all([
    upsertMetric(date, 'steps', steps, 'count', raw),
    upsertMetric(date, 'active_calories', active, 'kcal', raw),
    upsertMetric(date, 'resting_calories', resting, 'kcal', raw),
    upsertMetric(date, 'total_calories', total, 'kcal', raw),
    upsertMetric(date, 'calories', total, 'kcal', raw),
  ])

  for (const r of results) {
    if (r === 'upserted') upserted++
    else skipped++
  }
  return { upserted, skipped }
}

export async function processPushedDailiesWellness(
  summaries: GarminDailyWellness[],
): Promise<{ upserted: number; skipped: number }> {
  let upserted = 0
  let skipped = 0
  for (const s of summaries) {
    const r = await upsertWellnessFromDaily(s)
    upserted += r.upserted
    skipped += r.skipped
  }
  return { upserted, skipped }
}

/** Pull recent dailies from Garmin Wellness API and persist wellness metrics. */
export async function syncDailiesWellness(days = 30): Promise<{
  upserted: number
  skipped: number
  days: number
}> {
  const { accessToken } = await getValidAccessToken()
  const now = Math.floor(Date.now() / 1000)
  const start = now - days * 86400
  const res = await fetch(
    `https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${now}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin dailies wellness sync failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as GarminDailyWellness[]
  const result = await processPushedDailiesWellness(data ?? [])
  return { ...result, days }
}
