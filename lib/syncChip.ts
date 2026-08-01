/**
 * WP 1.4 — Sync chip contract (shared shape).
 * Web: components/shared/SyncStatusBadge.tsx
 * Mobile: mypens-mobile/components/SyncChip.tsx
 */

export type SyncSourceId = 'garmin' | 'healthconnect' | 'healthconnect_sleep' | 'healthconnect_workouts' | 'tanita'

export type SyncSourceStatus = {
  id: SyncSourceId
  label: string
  connected: boolean
  lastSuccessAt: string | null
  lastError: string | null
  lastErrorAt: string | null
}

export type SyncChipTone = 'ok' | 'error' | 'unknown'

export type SyncChipState = {
  sources: SyncSourceStatus[]
  /** Worst open error across sources, if any */
  primaryError: { label: string; message: string } | null
  /** ISO of most recent success across sources */
  lastAnySuccessAt: string | null
  /** True only with a success and no errors — never green on total failure */
  healthy: boolean
  tone: SyncChipTone
}

export function buildSyncChipState(sources: SyncSourceStatus[]): SyncChipState {
  const withError = sources.filter(s => Boolean(s.lastError))
  const successes = sources
    .map(s => s.lastSuccessAt)
    .filter((x): x is string => Boolean(x))
    .sort()
  const lastAnySuccessAt = successes.length ? successes[successes.length - 1]! : null
  const primaryError = withError.length
    ? { label: withError[0]!.label, message: withError[0]!.lastError! }
    : null
  const healthy = withError.length === 0 && lastAnySuccessAt != null
  const tone: SyncChipTone = primaryError ? 'error' : healthy ? 'ok' : 'unknown'
  return {
    sources,
    primaryError,
    lastAnySuccessAt,
    healthy,
    tone,
  }
}
