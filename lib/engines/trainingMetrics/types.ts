/** Daily training load in Pens Load Units (PLU) — see scripts/lib/trainingLoad.mjs */

export type DailyLoadPoint = {
  date: string // yyyy-mm-dd
  load: number
}

/** Banister / TrainingPeaks-style impulse–response state for one day. */
export type FitnessDay = {
  date: string
  load: number
  /** Chronic Training Load — ~42-day EWMA of daily load (Fitness). */
  ctl: number
  /** Acute Training Load — ~7-day EWMA of daily load (Fatigue). */
  atl: number
  /** Training Stress Balance — CTL − ATL (Form / Freshness). */
  tsb: number
  /** Acute:Chronic Workload Ratio — EWMA₇ / EWMA₂₈ (null until chronic warms up). */
  acwr: number | null
}

export type FosterWeek = {
  /** Inclusive start (yyyy-mm-dd). */
  from: string
  to: string
  weeklyLoad: number
  meanDaily: number
  sdDaily: number
  /** mean / SD — high = same load every day. Null when SD ≈ 0. */
  monotony: number | null
  /** weeklyLoad × monotony. */
  strain: number | null
  caveat: string
}

/** One GPS / sensor sample for grade-adjusted pace. */
export type GapSample = {
  /** Speed m/s (> 0). */
  speedMs: number
  /** Grade as fraction: +0.05 = 5% uphill. */
  grade: number
}

export type GapResult = {
  /** Equivalent flat-ground speed (m/s). */
  gapSpeedMs: number
  /** Pace sec/km on flat for equivalent metabolic cost. */
  gapPaceSecPerKm: number
  /** Actual pace sec/km. */
  actualPaceSecPerKm: number
  /** Cr(grade) / Cr(0) from Minetti et al. 2002. */
  costRatio: number
}

export type PeakPoint = {
  durationSec: number
  /** Best continuous average over that window; null if stream too short. */
  peak: number | null
}

export type RelativeEffortResult = {
  /** Edwards TRIMP — Σ (minutes in zone × zone index 1–5). */
  relativeEffort: number
  minutesByZone: [number, number, number, number, number]
  hrMax: number
  hrRest: number
}

export type EfficiencyPoint = {
  date: string
  sport: string
  distanceM: number
  durationSec: number
  paceSecPerKm: number | null
  kcalPerKm: number | null
  hrPerKm: number | null
}
