/**
 * Configurable TTL (in hours) for sync-error visibility on the home-screen
 * badge. A `lastError` / `lastErrorAt` pair older than this is treated as
 * stale and not surfaced — the underlying value is left in the database so
 * the per-integration detail page can still show "last failure was X ago",
 * but the dashboard badge stops nagging once the failure is old enough.
 *
 * A successful sync still clears the error immediately via the existing
 * write paths; this TTL only affects the *display* fallback for paths that
 * don't run often (e.g. Garmin webhook ping fetches).
 *
 * Override via the INTEGRATION_ERROR_TTL_HOURS environment variable.
 */
export const DEFAULT_INTEGRATION_ERROR_TTL_HOURS = 48

export function getIntegrationErrorTtlHours(): number {
  const raw = process.env.INTEGRATION_ERROR_TTL_HOURS
  if (!raw) return DEFAULT_INTEGRATION_ERROR_TTL_HOURS
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_INTEGRATION_ERROR_TTL_HOURS
  return n
}

/**
 * Returns true when the given error timestamp is older than the configured
 * TTL. Callers should null out the user-facing `lastError` / `lastErrorAt`
 * pair when this returns true.
 *
 * A missing timestamp returns false (not stale) so that legacy rows with a
 * `lastError` but no `lastErrorAt` still surface — we'd rather risk a small
 * amount of stale noise than silently swallow a real failure.
 */
export function isIntegrationErrorStale(
  at: Date | null | undefined,
  ttlHours: number = getIntegrationErrorTtlHours(),
): boolean {
  if (!at) return false
  const ageHours = (Date.now() - at.getTime()) / 3_600_000
  return ageHours > ttlHours
}
