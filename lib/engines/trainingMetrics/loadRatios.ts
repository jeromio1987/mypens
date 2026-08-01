import { addDaysIso } from './fitnessFreshness'
import type { DailyLoadPoint, FosterWeek } from './types'

const FOSTER_CAVEAT =
  'Foster monotony/strain is descriptive. High monotony means day-to-day load is very similar — not a proven injury predictor on its own.'

/**
 * Foster (1998) training monotony & strain over a fixed window (usually 7 days).
 *
 *   monotony = mean(dailyLoad) / SD(dailyLoad)
 *   strain   = Σ(dailyLoad) × monotony
 */
export function fosterMonotonyStrain(
  loads: number[],
  meta: { from: string; to: string },
): FosterWeek {
  const vals = loads.map((n) => Number(n) || 0)
  const n = vals.length
  const weeklyLoad = vals.reduce((a, b) => a + b, 0)
  const meanDaily = n > 0 ? weeklyLoad / n : 0

  let sdDaily = 0
  if (n > 1) {
    const varSum = vals.reduce((a, v) => a + (v - meanDaily) ** 2, 0)
    sdDaily = Math.sqrt(varSum / (n - 1))
  }

  let monotony: number | null = null
  let strain: number | null = null
  if (sdDaily > 1e-6) {
    monotony = round2(meanDaily / sdDaily)
    strain = round2(weeklyLoad * monotony)
  } else if (weeklyLoad > 0) {
    // Flat non-zero week — conceptually infinite monotony; cap for display.
    monotony = null
    strain = null
  }

  return {
    from: meta.from,
    to: meta.to,
    weeklyLoad: round2(weeklyLoad),
    meanDaily: round2(meanDaily),
    sdDaily: round2(sdDaily),
    monotony,
    strain,
    caveat: FOSTER_CAVEAT,
  }
}

/**
 * Rolling Foster weeks ending on each day that has a full `windowDays` history.
 */
export function rollingFosterWeeks(
  points: DailyLoadPoint[],
  windowDays = 7,
): FosterWeek[] {
  if (points.length < windowDays) return []
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const out: FosterWeek[] = []
  for (let i = windowDays - 1; i < sorted.length; i++) {
    const slice = sorted.slice(i - windowDays + 1, i + 1)
    // Prefer contiguous calendar; if dates have gaps, still score the slice loads.
    out.push(
      fosterMonotonyStrain(
        slice.map((p) => p.load),
        { from: slice[0].date, to: slice[slice.length - 1].date },
      ),
    )
  }
  return out
}

/** Foster week ending on `endDate` (inclusive), filling zeros for missing days. */
export function fosterWeekEnding(
  points: DailyLoadPoint[],
  endDate: string,
  windowDays = 7,
): FosterWeek {
  const byDate = new Map(points.map((p) => [p.date, Number(p.load) || 0]))
  const from = addDaysIso(endDate, -(windowDays - 1))
  const loads: number[] = []
  for (let d = from; d <= endDate; d = addDaysIso(d, 1)) {
    loads.push(byDate.get(d) || 0)
  }
  return fosterMonotonyStrain(loads, { from, to: endDate })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const LOAD_RATIOS_META = {
  foster: 'monotony = mean/SD over 7d; strain = weeklyLoad × monotony',
  acwr: 'See buildFitnessSeries — EWMA₇ / EWMA₂₈ on same daily PLU series',
}
