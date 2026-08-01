import type { EfficiencyPoint } from './types'

export type SessionEfficiencyInput = {
  date: string
  sport: string
  distanceM: number
  durationSec: number
  calories?: number | null
  avgHr?: number | null
}

/**
 * Per-session efficiency proxies for fitness-trend / drift charts.
 * Descriptive only — terrain, heat, and device bias confound these.
 */
export function sessionEfficiency(a: SessionEfficiencyInput): EfficiencyPoint | null {
  const distanceM = Number(a.distanceM)
  const durationSec = Number(a.durationSec)
  if (!(distanceM >= 100) || !(durationSec > 0)) return null

  const km = distanceM / 1000
  const paceSecPerKm = durationSec / km
  const kcal = a.calories != null ? Number(a.calories) : null
  const hr = a.avgHr != null ? Number(a.avgHr) : null

  return {
    date: a.date,
    sport: a.sport,
    distanceM,
    durationSec,
    paceSecPerKm: round1(paceSecPerKm),
    kcalPerKm: kcal != null && kcal > 0 ? round2(kcal / km) : null,
    hrPerKm: hr != null && hr > 0 ? round2(hr / km) : null,
  }
}

/**
 * Median of a numeric field across sessions (same sport), for drift baselines.
 */
export function medianEfficiency(
  points: EfficiencyPoint[],
  field: 'paceSecPerKm' | 'kcalPerKm' | 'hrPerKm',
): number | null {
  const vals = points
    .map((p) => p[field])
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((a, b) => a - b)
  if (!vals.length) return null
  const mid = Math.floor(vals.length / 2)
  if (vals.length % 2 === 1) return vals[mid]
  return round2((vals[mid - 1] + vals[mid]) / 2)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const EFFICIENCY_META = {
  formula: 'pace = duration/km; kcalPerKm; hrPerKm — group by sport for drift',
  honesty: 'Not lab economy. Use matched sport + similar distance bands.',
}
