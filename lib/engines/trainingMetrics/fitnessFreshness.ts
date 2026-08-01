import type { DailyLoadPoint, FitnessDay } from './types'
import { shiftDateStr } from '@/lib/timeWindow'

/** TrainingPeaks / Strava-style time constants (days). */
export const CTL_TAU = 42
export const ATL_TAU = 7
/** ACWR chronic limb — shorter than CTL Fitness. */
export const ACWR_CHRONIC_TAU = 28
export const ACWR_ACUTE_TAU = 7

/** Minimum chronic EWMA before ACWR is reported (avoid early noise). */
const ACWR_MIN_CHRONIC = 5

export function ewmaAlpha(tauDays: number): number {
  if (!(tauDays > 0)) throw new Error('tauDays must be > 0')
  return 1 - Math.exp(-1 / tauDays)
}

/** @deprecated Prefer shiftDateStr from lib/timeWindow — kept as alias for callers. */
export function addDaysIso(iso: string, n: number): string {
  return shiftDateStr(iso, n)
}

/** Inclusive calendar fill; missing days → load 0. */
export function fillDailyLoads(
  points: DailyLoadPoint[],
  from?: string,
  to?: string,
): DailyLoadPoint[] {
  if (!points.length && (!from || !to)) return []
  const byDate = new Map<string, number>()
  for (const p of points) {
    byDate.set(p.date, (byDate.get(p.date) || 0) + (Number(p.load) || 0))
  }
  const dates = [...byDate.keys()].sort()
  const start = from ?? dates[0]
  const end = to ?? dates[dates.length - 1]
  if (!start || !end || start > end) return []

  const out: DailyLoadPoint[] = []
  for (let d = start; d <= end; d = addDaysIso(d, 1)) {
    out.push({ date: d, load: round2(byDate.get(d) || 0) })
  }
  return out
}

export type FitnessSeriesOpts = {
  ctlTau?: number
  atlTau?: number
  acwrAcuteTau?: number
  acwrChronicTau?: number
  /** Seed CTL before first day (default 0). */
  seedCtl?: number
  seedAtl?: number
  seedAcwrAcute?: number
  seedAcwrChronic?: number
  from?: string
  to?: string
}

/**
 * Banister impulse–response Fitness & Freshness from daily PLU (or TSS-like) loads.
 *
 *   CTLₜ = α_ctl·loadₜ + (1−α_ctl)·CTLₜ₋₁     (Fitness)
 *   ATLₜ = α_atl·loadₜ + (1−α_atl)·ATLₜ₋₁     (Fatigue)
 *   TSBₜ = CTLₜ − ATLₜ                         (Form)
 *
 * α = 1 − e^(−1/τ). Same family as Strava Fitness/Freshness and TrainingPeaks CTL/ATL/TSB.
 */
export function buildFitnessSeries(
  points: DailyLoadPoint[],
  opts: FitnessSeriesOpts = {},
): FitnessDay[] {
  const filled = fillDailyLoads(points, opts.from, opts.to)
  if (!filled.length) return []

  const aCtl = ewmaAlpha(opts.ctlTau ?? CTL_TAU)
  const aAtl = ewmaAlpha(opts.atlTau ?? ATL_TAU)
  const aAcu = ewmaAlpha(opts.acwrAcuteTau ?? ACWR_ACUTE_TAU)
  const aChr = ewmaAlpha(opts.acwrChronicTau ?? ACWR_CHRONIC_TAU)

  let ctl = opts.seedCtl ?? 0
  let atl = opts.seedAtl ?? 0
  let acu = opts.seedAcwrAcute ?? 0
  let chr = opts.seedAcwrChronic ?? 0

  const out: FitnessDay[] = []
  for (const { date, load } of filled) {
    ctl = aCtl * load + (1 - aCtl) * ctl
    atl = aAtl * load + (1 - aAtl) * atl
    acu = aAcu * load + (1 - aAcu) * acu
    chr = aChr * load + (1 - aChr) * chr

    const acwr =
      chr >= ACWR_MIN_CHRONIC ? round3(acu / chr) : null

    out.push({
      date,
      load,
      ctl: round2(ctl),
      atl: round2(atl),
      tsb: round2(ctl - atl),
      acwr,
    })
  }
  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export const FITNESS_FRESHNESS_META = {
  unit: 'PLU-EWMA',
  ctlTau: CTL_TAU,
  atlTau: ATL_TAU,
  formula:
    'CTL/ATL Banister EWMA on daily PLU; TSB = CTL − ATL; ACWR = EWMA₇ / EWMA₂₈',
  honesty:
    'Descriptive training-load model — not a medical readiness diagnosis. ACWR has known statistical criticisms; report with coverage.',
}
