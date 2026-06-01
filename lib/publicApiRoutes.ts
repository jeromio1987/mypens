/**
 * API path prefixes that skip session / mobile-bearer checks in `proxy.ts`.
 * Kept in one module so middleware and tests stay aligned.
 */
export const PUBLIC_API_PREFIXES = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/integrations/garmin/callback',
  '/api/integrations/garmin/webhook',
  '/api/integrations/garmin/cron',
  '/api/integrations/strava/callback',
  '/api/integrations/strava/webhook',
  '/api/integrations/strava/cron',
  '/api/integrations/healthkit/ingest',
  '/api/integrations/healthconnect/ingest',
  '/api/cron/',
  '/api/public/',
] as const

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
