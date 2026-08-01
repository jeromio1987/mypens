import type { PeakPoint } from './types'

/** Common critical-power / peak-pace windows (seconds). */
export const DEFAULT_PEAK_DURATIONS_SEC = [
  5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 1200, 1800, 3600,
] as const

/**
 * Maximum continuous average over each duration for a uniformly sampled stream.
 *
 * @param samples equally spaced values (power W, speed m/s, HR bpm, …)
 * @param sampleHz samples per second (1 = 1 Hz FIT records)
 */
export function peakRollingAverages(
  samples: number[],
  durationsSec: readonly number[] = DEFAULT_PEAK_DURATIONS_SEC,
  sampleHz = 1,
): PeakPoint[] {
  if (!(sampleHz > 0) || !samples.length) {
    return durationsSec.map((durationSec) => ({ durationSec, peak: null }))
  }

  const vals = samples.map((v) => Number(v))
  return durationsSec.map((durationSec) => {
    const window = Math.round(durationSec * sampleHz)
    if (window < 1 || window > vals.length) {
      return { durationSec, peak: null }
    }
    return { durationSec, peak: round3(maxMeanWindow(vals, window)) }
  })
}

/**
 * Peak rolling average for irregular timestamps.
 * `timesSec` must be sorted ascending; values aligned 1:1.
 */
export function peakRollingAveragesTimed(
  timesSec: number[],
  values: number[],
  durationsSec: readonly number[] = DEFAULT_PEAK_DURATIONS_SEC,
): PeakPoint[] {
  if (timesSec.length !== values.length || timesSec.length === 0) {
    return durationsSec.map((durationSec) => ({ durationSec, peak: null }))
  }

  return durationsSec.map((durationSec) => {
    let peak: number | null = null
    let left = 0
    let sum = 0
    let count = 0

    for (let right = 0; right < timesSec.length; right++) {
      sum += values[right]
      count++
      while (left <= right && timesSec[right] - timesSec[left] > durationSec) {
        sum -= values[left]
        count--
        left++
      }
      const span = timesSec[right] - timesSec[left]
      // Require nearly full window (≥ 90%) so short edges don't dominate.
      if (count > 0 && span >= durationSec * 0.9) {
        const mean = sum / count
        if (peak == null || mean > peak) peak = mean
      }
    }
    return { durationSec, peak: peak == null ? null : round3(peak) }
  })
}

function maxMeanWindow(vals: number[], window: number): number {
  let sum = 0
  for (let i = 0; i < window; i++) sum += vals[i]
  let best = sum / window
  for (let i = window; i < vals.length; i++) {
    sum += vals[i] - vals[i - window]
    const mean = sum / window
    if (mean > best) best = mean
  }
  return best
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export const PEAK_CURVES_META = {
  formula: 'max continuous mean over sliding window of duration D',
  note: 'Works for power, pace (use speed), or HR streams. No streams stored in GarminActivity today — callers must pass FIT/GPX samples.',
}
