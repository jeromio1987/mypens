/** Shared sleep / HRV scoring — used by `/api/readiness` and cross-app snapshot writer. */

export function computeSleepScore(hours: number, quality: number): number {
  const hoursScore = Math.min(1, hours / 8) * 60
  const qualityScore = ((quality - 1) / 4) * 40
  return Math.round(hoursScore + qualityScore)
}

/** 0–100: 100 = HRV at or above baseline. */
export function computeHrvReadiness(hrv: number, baseline14d: number | null): number | null {
  if (!baseline14d || baseline14d === 0) return null
  const ratio = hrv / baseline14d
  return Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

export function readinessLabel(score: number): string {
  if (score >= 80) return 'Full recovery'
  if (score >= 65) return 'Good shape'
  if (score >= 50) return 'Reduced capacity'
  if (score >= 35) return 'Compromised'
  return 'Poor'
}

export type SleepRow = { date: string; hours: number; quality: number; hrv: number | null }

/**
 * Baseline: mean HRV of up to 14 prior nights (strictly before `forDate`) that have HRV set.
 */
export function baselineHrvBefore(priorDescending: SleepRow[], forDate: string): number | null {
  const strictlyPrior = priorDescending.filter(e => e.date < forDate && e.hrv != null)
  if (strictlyPrior.length < 3) return null
  const slice = strictlyPrior.slice(0, 14)
  const sum = slice.reduce((s, e) => s + (e.hrv as number), 0)
  return sum / slice.length
}

export function sleepScoresForNight(
  night: SleepRow,
  priorDescending: SleepRow[],
): { sleepScore: number; hrvReadiness: number | null } {
  const sleepScore = computeSleepScore(night.hours, night.quality)
  const baseline = baselineHrvBefore(priorDescending, night.date)
  const hrvReadiness =
    night.hrv != null && baseline != null ? computeHrvReadiness(night.hrv, baseline) : null
  return { sleepScore, hrvReadiness }
}

/**
 * Matches legacy `/api/readiness` behaviour: baseline is mean HRV of up to the 14 most recent
 * nights that have HRV (including the latest night). Requires ≥3 HRV samples in that window.
 */
export function hrvReadinessInclusiveRolling(entriesDateDesc: SleepRow[]): number | null {
  const latest = entriesDateDesc[0]
  if (!latest?.hrv) return null
  const withHrv = entriesDateDesc.filter(e => e.hrv != null)
  if (withHrv.length < 3) return null
  const baseline =
    withHrv.slice(0, 14).reduce((s, e) => s + (e.hrv as number), 0) / Math.min(withHrv.length, 14)
  return computeHrvReadiness(latest.hrv, baseline)
}
