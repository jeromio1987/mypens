import type { RelativeEffortResult } from './types'

/**
 * Edwards (1993) heart-rate zone TRIMP — Strava Relative Effort family.
 *
 * Zones as % of HRmax (common 5-zone model):
 *   Z1 50–60% · Z2 60–70% · Z3 70–80% · Z4 80–90% · Z5 ≥90%
 * Score = Σ (minutes in zone × zone index).
 *
 * Prefer zone minutes from a stream. `fromAvgHr` is a coarse single-bucket fallback.
 */
export function edwardsRelativeEffort(
  minutesByZone: [number, number, number, number, number],
  opts: { hrMax: number; hrRest?: number } = { hrMax: 185 },
): RelativeEffortResult {
  const zones = minutesByZone.map((m) => Math.max(0, Number(m) || 0)) as [
    number,
    number,
    number,
    number,
    number,
  ]
  let relativeEffort = 0
  for (let i = 0; i < 5; i++) {
    relativeEffort += zones[i] * (i + 1)
  }
  return {
    relativeEffort: round1(relativeEffort),
    minutesByZone: zones,
    hrMax: opts.hrMax,
    hrRest: opts.hrRest ?? 50,
  }
}

/** Map one HR sample to Edwards zone index 1–5, or 0 if below Z1. */
export function edwardsZoneIndex(hr: number, hrMax: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!(hrMax > 0) || !(hr > 0)) return 0
  const pct = hr / hrMax
  if (pct < 0.5) return 0
  if (pct < 0.6) return 1
  if (pct < 0.7) return 2
  if (pct < 0.8) return 3
  if (pct < 0.9) return 4
  return 5
}

/**
 * Build Edwards minutes from a uniform HR stream (e.g. 1 Hz).
 */
export function edwardsFromHrStream(
  hrSamples: number[],
  opts: { hrMax: number; hrRest?: number; sampleHz?: number },
): RelativeEffortResult {
  const hz = opts.sampleHz ?? 1
  const zones: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  const secPerSample = 1 / hz
  for (const hr of hrSamples) {
    const z = edwardsZoneIndex(hr, opts.hrMax)
    if (z >= 1) zones[z - 1] += secPerSample / 60
  }
  return edwardsRelativeEffort(zones, opts)
}

/**
 * Coarse fallback when only average HR + duration exist (no zone stream).
 * Puts all minutes into the single zone matching avg HR — underestimates mixed sessions.
 */
export function edwardsFromAvgHr(opts: {
  avgHr: number
  durationSec: number
  hrMax: number
  hrRest?: number
}): RelativeEffortResult {
  const minutes = Math.max(0, opts.durationSec) / 60
  const zones: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  const z = edwardsZoneIndex(opts.avgHr, opts.hrMax)
  if (z >= 1) zones[z - 1] = minutes
  return edwardsRelativeEffort(zones, opts)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export const RELATIVE_EFFORT_META = {
  model: 'Edwards 1993 zone TRIMP',
  vsPlu:
    'PLU (trainingLoad.mjs) uses continuous Banister TRIMP × sport weight. Edwards is the classic Strava Relative Effort zone score. Prefer PLU for cockpit load; Edwards when comparing to Strava-like zone effort.',
}
