/**
 * WP 1.4 — Sync chip contract (mobile mirror of lib/syncChip.ts).
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
  primaryError: { label: string; message: string } | null
  lastAnySuccessAt: string | null
  /** True only when we have a success and no open errors — never “green” on total failure. */
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
