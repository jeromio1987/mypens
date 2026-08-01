/**
 * Shared session-level dedup for energy EAT and training-load paths
 * (FULL-ENGINE-AUDIT E3/E4/E5/T1).
 *
 * Match on time overlap (≥50% of the shorter session), not day-level
 * `hasGarminCals` that dropped evening sessions. Prefer FIT archive >
 * device training > Strava > HC package preference > manual.
 */

export type SessionCandidate = {
  id: string
  /** Epoch ms; null = cannot overlap-match (kept unless id-collides). */
  startMs: number | null
  endMs: number | null
  durationSec: number
  /** Source label for preference + debug. */
  source: string
  /** Higher wins on overlap. */
  preference: number
  kcal?: number | null
}

const OVERLAP_RATIO = 0.5

/** Preference tiers used by energy + load paths. */
export function sessionPreference(
  kind: 'garmin_activity' | 'training' | 'pushed',
  source?: string | null,
  packageName?: string | null,
): number {
  if (kind === 'garmin_activity') return 100
  if (kind === 'pushed') return 25
  const src = (source ?? '').toLowerCase()
  const pkg = (packageName ?? '').toLowerCase()
  if (src === 'garmin') return 80
  if (src === 'strava') return 70
  if (src === 'healthconnect' || src === 'healthkit') {
    if (pkg.includes('garmin')) return 60
    if (pkg.includes('fitness') || pkg.includes('google')) return 35
    return 45
  }
  if (src === 'manual') return 30
  return 40
}

/**
 * Synthetic window for legacy rows — only for display/ordering helpers.
 * Do NOT use for overlap dedup: inventing noon windows falsely collapses
 * distinct same-day sessions (walk + evening gym). Untimed sessions are kept
 * unless they overlap a peer that also has real timestamps.
 */
export function syntheticWindowFromDate(
  date: string,
  durationSec: number,
  noonHour = 12,
): { startMs: number; endMs: number } {
  const [y, m, d] = date.split('-').map(Number)
  const startMs = Date.UTC(y, m - 1, d, noonHour, 0, 0, 0)
  const dur = Math.max(0, Math.round(durationSec || 0)) * 1000
  return { startMs, endMs: startMs + Math.max(dur, 60_000) }
}

export function sessionsOverlap(
  a: Pick<SessionCandidate, 'startMs' | 'endMs' | 'durationSec'>,
  b: Pick<SessionCandidate, 'startMs' | 'endMs' | 'durationSec'>,
  ratio = OVERLAP_RATIO,
): boolean {
  if (a.startMs == null || a.endMs == null || b.startMs == null || b.endMs == null) return false
  if (!(a.endMs > a.startMs) || !(b.endMs > b.startMs)) return false
  const overlapSec = Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs)) / 1000
  const shorter = Math.min(
    a.durationSec > 0 ? a.durationSec : (a.endMs - a.startMs) / 1000,
    b.durationSec > 0 ? b.durationSec : (b.endMs - b.startMs) / 1000,
  )
  if (shorter <= 0) return false
  return overlapSec >= shorter * ratio
}

/**
 * Drop overlapping duplicates, keeping the higher-preference session.
 * Tie-break: longer duration, then higher kcal, then stable id order.
 */
export function dedupeSessions<T extends SessionCandidate>(sessions: T[]): T[] {
  if (sessions.length <= 1) return sessions.slice()
  const sorted = [...sessions].sort((a, b) => {
    if (b.preference !== a.preference) return b.preference - a.preference
    if (b.durationSec !== a.durationSec) return b.durationSec - a.durationSec
    const ak = a.kcal ?? 0
    const bk = b.kcal ?? 0
    if (bk !== ak) return bk - ak
    return a.id.localeCompare(b.id)
  })
  const kept: T[] = []
  for (const s of sorted) {
    const dup = kept.some(k => sessionsOverlap(k, s))
    if (!dup) kept.push(s)
  }
  // Restore roughly chronological order for stable UI lists
  kept.sort((a, b) => {
    const as = a.startMs ?? 0
    const bs = b.startMs ?? 0
    if (as !== bs) return as - bs
    return a.id.localeCompare(b.id)
  })
  return kept
}

/** Parse HC/Strava-ish externalRaw for start/end/package. */
export function parseTrainingWindow(externalRaw: string | null | undefined): {
  startMs: number | null
  endMs: number | null
  durationSec: number
  packageName: string
} {
  if (!externalRaw) {
    return { startMs: null, endMs: null, durationSec: 0, packageName: '' }
  }
  try {
    const o = JSON.parse(externalRaw) as {
      startTime?: string
      endTime?: string
      start_date?: string
      elapsed_time?: number
      moving_time?: number
      packageName?: string
      durationSec?: number
    }
    const start = Date.parse(o.startTime ?? o.start_date ?? '')
    let end = Date.parse(o.endTime ?? '')
    const durationSec =
      o.durationSec ??
      o.elapsed_time ??
      o.moving_time ??
      (Number.isFinite(start) && Number.isFinite(end) && end > start
        ? Math.round((end - start) / 1000)
        : 0)
    if (Number.isFinite(start) && (!Number.isFinite(end) || end <= start) && durationSec > 0) {
      end = start + durationSec * 1000
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return { startMs: null, endMs: null, durationSec: durationSec || 0, packageName: o.packageName ?? '' }
    }
    return {
      startMs: start,
      endMs: end,
      durationSec: durationSec || Math.round((end - start) / 1000),
      packageName: o.packageName ?? '',
    }
  } catch {
    return { startMs: null, endMs: null, durationSec: 0, packageName: '' }
  }
}
