/**
 * WP 1.4 — Sync chip contract (mobile mirror of lib/syncChip.ts).
 */

export type SyncSourceId = 'garmin' | 'healthconnect_sleep' | 'healthconnect_workouts' | 'tanita'

export type SyncSourceStatus = {
  id: SyncSourceId
  label: string
  connected: boolean
  lastSuccessAt: string | null
  lastError: string | null
  lastErrorAt: string | null
}

export type SyncChipState = {
  sources: SyncSourceStatus[]
  primaryError: { label: string; message: string } | null
  lastAnySuccessAt: string | null
  healthy: boolean
}

export function buildSyncChipState(sources: SyncSourceStatus[]): SyncChipState {
  const withError = sources.filter(s => s.connected && s.lastError)
  const successes = sources
    .map(s => s.lastSuccessAt)
    .filter((x): x is string => Boolean(x))
    .sort()
  const lastAnySuccessAt = successes.length ? successes[successes.length - 1]! : null
  const primaryError = withError.length
    ? { label: withError[0]!.label, message: withError[0]!.lastError! }
    : null
  return {
    sources,
    primaryError,
    lastAnySuccessAt,
    healthy: withError.length === 0,
  }
}
