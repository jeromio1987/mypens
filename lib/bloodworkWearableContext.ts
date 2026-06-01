/**
 * Build a **context** window around a lab draw date — sleep and training aggregates
 * for narrative framing (“what else was on the ledger”), never causal inference.
 */

export function ymdAddDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86400000
  const dt = new Date(t)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Inclusive range of `dayCount` days ending on `endYmd` (yyyy-mm-dd). */
export function inclusiveRangeEnding(endYmd: string, dayCount: number): string[] {
  if (dayCount < 1) return []
  const start = ymdAddDays(endYmd, -(dayCount - 1))
  const out: string[] = []
  let cur = start
  // Lexicographic order matches chronological order for ISO dates.
  // Guard loop with max iterations.
  for (let i = 0; i < 400 && cur <= endYmd; i++) {
    out.push(cur)
    if (cur === endYmd) break
    cur = ymdAddDays(cur, 1)
  }
  return out
}

export type SleepDayContext = {
  date: string
  hours: number
  quality: number
  hrv: number | null
}

export type TrainingDayContext = {
  date: string
  sessionCount: number
  totalVolume: number
}

export type LabWearableContextPayload = {
  drawDate: string
  windowDays: number
  windowDates: string[]
  disclaimer: string
  sleepByDate: SleepDayContext[]
  sleepNightsLogged: number
  avgSleepHours: number | null
  hrvNightsLogged: number
  avgHrvMs: number | null
  trainingByDate: TrainingDayContext[]
  trainingSessions: number
  trainingVolumeSum: number
}

const DEFAULT_DISCLAIMER =
  'Context only: these overlaps are not explanations for your lab results and are not medical advice.'

export function buildLabWearableContextPayload(input: {
  drawDate: string
  windowDays?: number
  sleepRows: { date: string; hours: number; quality: number; hrv: number | null }[]
  trainingRows: { date: string; volume: number }[]
}): LabWearableContextPayload {
  const windowDays = input.windowDays ?? 10
  const windowDates = inclusiveRangeEnding(input.drawDate, windowDays)
  const set = new Set(windowDates)

  const sleepByDate = input.sleepRows
    .filter(r => set.has(r.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({ date: r.date, hours: r.hours, quality: r.quality, hrv: r.hrv }))

  const sleepNightsLogged = sleepByDate.length
  const avgSleepHours =
    sleepNightsLogged > 0 ? sleepByDate.reduce((s, r) => s + r.hours, 0) / sleepNightsLogged : null

  const withHrv = sleepByDate.filter(r => r.hrv != null && Number.isFinite(r.hrv)) as (SleepDayContext & { hrv: number })[]
  const hrvNightsLogged = withHrv.length
  const avgHrvMs =
    hrvNightsLogged > 0 ? withHrv.reduce((s, r) => s + r.hrv, 0) / hrvNightsLogged : null

  const volByDate = new Map<string, { sessionCount: number; totalVolume: number }>()
  for (const row of input.trainingRows) {
    if (!set.has(row.date)) continue
    const cur = volByDate.get(row.date) ?? { sessionCount: 0, totalVolume: 0 }
    cur.sessionCount += 1
    cur.totalVolume += row.volume
    volByDate.set(row.date, cur)
  }

  const trainingByDate = windowDates
    .map(date => {
      const v = volByDate.get(date)
      return { date, sessionCount: v?.sessionCount ?? 0, totalVolume: v?.totalVolume ?? 0 }
    })
    .filter(d => d.sessionCount > 0)

  let trainingSessions = 0
  let trainingVolumeSum = 0
  for (const d of trainingByDate) {
    trainingSessions += d.sessionCount
    trainingVolumeSum += d.totalVolume
  }

  return {
    drawDate: input.drawDate,
    windowDays,
    windowDates,
    disclaimer: DEFAULT_DISCLAIMER,
    sleepByDate,
    sleepNightsLogged,
    avgSleepHours,
    hrvNightsLogged,
    avgHrvMs,
    trainingByDate,
    trainingSessions,
    trainingVolumeSum,
  }
}
