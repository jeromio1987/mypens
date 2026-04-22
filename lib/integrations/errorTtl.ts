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
 * TTL (or null / missing). Callers should null out the user-facing
 * `lastError` / `lastErrorAt` pair when this returns true.
 */
export function isIntegrationErrorStale(
  at: Date | null | undefined,
  ttlHours: number = getIntegrationErrorTtlHours(),
): boolean {
  if (!at) return true
  const ageHours = (Date.now() - at.getTime()) / 3_600_000
  return ageHours > ttlHours
}
