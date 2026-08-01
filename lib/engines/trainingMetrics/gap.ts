import type { GapResult, GapSample } from './types'

/**
 * Minetti et al. (2002) metabolic cost of running Cr(i) in J·kg⁻¹·m⁻¹
 * where i is incline as a fraction (0.05 = 5%).
 *
 * Valid roughly −0.45 … +0.45. Outside that range we clamp for stability.
 */
export function minettiRunningCost(grade: number): number {
  const i = clamp(grade, -0.45, 0.45)
  return (
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    3.6
  )
}

const CR_FLAT = minettiRunningCost(0)

/**
 * Grade-adjusted pace for one sample (Strava GAP family).
 *
 * Same metabolic cost on flat: Cr(0)·gapSpeed ≈ Cr(grade)·speed
 *   ⇒ gapSpeed = speed × Cr(grade)/Cr(0)
 *
 * Uphill → higher cost → faster GAP (lower sec/km) for the same ground speed.
 */
export function gradeAdjustedPace(sample: GapSample): GapResult | null {
  const speed = Number(sample.speedMs)
  if (!(speed > 0)) return null

  const cr = minettiRunningCost(sample.grade)
  if (!(cr > 0)) return null

  const costRatio = cr / CR_FLAT
  const gapSpeedMs = speed * costRatio
  const actualPaceSecPerKm = 1000 / speed
  const gapPaceSecPerKm = 1000 / gapSpeedMs

  return {
    gapSpeedMs: round4(gapSpeedMs),
    gapPaceSecPerKm: round2(gapPaceSecPerKm),
    actualPaceSecPerKm: round2(actualPaceSecPerKm),
    costRatio: round4(costRatio),
  }
}

/**
 * Mean GAP over a stream (distance-weighted by sample speed ≈ time-equal if 1 Hz).
 */
export function gradeAdjustedPaceStream(samples: GapSample[]): GapResult | null {
  let dist = 0
  let gapDist = 0
  let n = 0
  let costSum = 0

  for (const s of samples) {
    const g = gradeAdjustedPace(s)
    if (!g) continue
    // Assume equal time steps: weight by speed so faster samples cover more distance.
    const w = s.speedMs
    dist += w
    gapDist += g.gapSpeedMs
    costSum += g.costRatio
    n++
  }
  if (n === 0 || !(dist > 0)) return null

  const meanSpeed = dist / n
  const meanGapSpeed = gapDist / n
  return {
    gapSpeedMs: round4(meanGapSpeed),
    gapPaceSecPerKm: round2(1000 / meanGapSpeed),
    actualPaceSecPerKm: round2(1000 / meanSpeed),
    costRatio: round4(costSum / n),
  }
}

/**
 * Activity-level GAP when only totals exist (no GPS stream).
 * Uses average grade ≈ elevationGain / distance (one-way climb proxy — coarse).
 */
export function gradeAdjustedPaceFromTotals(opts: {
  distanceM: number
  durationSec: number
  elevationGainM?: number | null
}): GapResult | null {
  const distanceM = Number(opts.distanceM)
  const durationSec = Number(opts.durationSec)
  if (!(distanceM > 0) || !(durationSec > 0)) return null

  const elev = Number(opts.elevationGainM) || 0
  const grade = elev > 0 ? elev / distanceM : 0
  const speedMs = distanceM / durationSec
  return gradeAdjustedPace({ speedMs, grade })
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export const GAP_META = {
  source: 'Minetti et al. (2002) Cr(i) polynomial',
  formula: 'gapSpeed = speed × Cr(grade)/Cr(0); grade = rise/run',
  honesty:
    'Activity-level GAP from total elevation/distance is a coarse proxy — prefer GPS streams when available. Running model; not valid for cycling.',
}
