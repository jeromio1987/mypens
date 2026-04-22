/**
 * Configurable threshold (in hours) after which we treat a mobile companion
 * pairing as "stale" — the iOS / Android app hasn't pushed background data in
 * a while, likely because the OS disabled background refresh, the user revoked
 * Health Connect access, or the pairing token was rotated. The /integrations
 * page surfaces a warning past this gap so users know to re-open the app.
 *
 * Override via the MOBILE_STALE_THRESHOLD_HOURS environment variable.
 */
export const DEFAULT_MOBILE_STALE_THRESHOLD_HOURS = 48

export function getMobileStaleThresholdHours(): number {
  const raw = process.env.MOBILE_STALE_THRESHOLD_HOURS
  if (!raw) return DEFAULT_MOBILE_STALE_THRESHOLD_HOURS
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MOBILE_STALE_THRESHOLD_HOURS
  return n
}
