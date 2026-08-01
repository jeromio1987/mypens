/** Shared sleep / HRV scoring — used by `/api/readiness` and cross-app snapshot writer. */

export type SleepScoreResult = {
  /** 0–100 on the full scale (duration+quality) or duration-only renormalised. */
  score: number
  /** True when quality/HRV missing — duration renormalised to 0–100, not capped at 60. */
  durationOnly: boolean
}

/**
 * Sleep score 0–100. Quality is HRV-derived 1–5.
 * When quality is null (no HRV): renormalise duration to 0–100 and tag durationOnly
 * (S1) — never return a partial-scale 60 labelled "Reduced capacity" on the full scale.
 */
export function computeSleepScoreDetailed(
  hours: number,
  quality: number | null | undefined,
): SleepScoreResult {
  const hoursFrac = Math.min(1, Math.max(0, hours / 8))
  if (quality == null || !Number.isFinite(quality)) {
    return { score: Math.round(hoursFrac * 100), durationOnly: true }
  }
  const hoursScore = hoursFrac * 60
  const qualityScore = ((quality - 1) / 4) * 40
  return { score: Math.round(hoursScore + qualityScore), durationOnly: false }
}

/** Sleep score 0–100 (see computeSleepScoreDetailed for durationOnly flag). */
export function computeSleepScore(hours: number, quality: number | null | undefined): number {
  return computeSleepScoreDetailed(hours, quality).score
}

/** 0–100: 100 = HRV at or above baseline. */
export function computeHrvReadiness(hrv: number, baseline14d: number | null): number | null {
  if (!baseline14d || baseline14d === 0) return null
  const ratio = hrv / baseline14d
  return Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

export function readinessLabel(score: number, opts?: { durationOnly?: boolean }): string {
  if (opts?.durationOnly) {
    if (score >= 80) return 'Duration OK (no HRV)'
    if (score >= 65) return 'Duration fair (no HRV)'
    if (score >= 50) return 'Short sleep (no HRV)'
    return 'Very short sleep (no HRV)'
  }
  if (score >= 80) return 'Full recovery'
  if (score >= 65) return 'Good shape'
  if (score >= 50) return 'Reduced capacity'
  if (score >= 35) return 'Compromised'
  return 'Poor'
}

export type SleepRow = { date: string; hours: number; quality: number | null; hrv: number | null }

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
): { sleepScore: number; hrvReadiness: number | null; durationOnly: boolean } {
  const detailed = computeSleepScoreDetailed(night.hours, night.quality)
  const baseline = baselineHrvBefore(priorDescending, night.date)
  const hrvReadiness =
    night.hrv != null && baseline != null ? computeHrvReadiness(night.hrv, baseline) : null
  return { sleepScore: detailed.score, hrvReadiness, durationOnly: detailed.durationOnly }
}

/**
 * @deprecated Inclusive rolling puts the night inside its own baseline (H1).
 * Prefer baselineHrvBefore + computeHrvReadiness. Kept as a thin alias for legacy callers.
 */
export function hrvReadinessInclusiveRolling(entriesDateDesc: SleepRow[]): number | null {
  const latest = entriesDateDesc[0]
  if (!latest?.hrv) return null
  // Strict prior baseline — same as sleepScoresForNight (H1 fix).
  const baseline = baselineHrvBefore(entriesDateDesc, latest.date)
  return baseline != null ? computeHrvReadiness(latest.hrv, baseline) : null
}
