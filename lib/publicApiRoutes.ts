/**

 * API paths that skip session / mobile-bearer checks in `proxy.ts`.

 * Kept in one module so middleware and tests stay aligned.

 *

 * Fail-closed: only exact allowlisted paths (or a trailing `/` subpath of an

 * allowlisted route) are public. Open prefixes like `/api/cron/` are NOT used —

 * a new file under `app/api/cron/` without its own secret check must be added

 * here explicitly (and must verify CRON_SECRET in-route).

 *

 * Boundary rule: `/api/health` does not match `/api/health-debug`.

 */

export const PUBLIC_API_ROUTES = [

  '/api/health',

  '/api/auth/login',

  '/api/auth/logout',

  '/api/auth/session',

  '/api/integrations/garmin/callback',

  '/api/integrations/garmin/webhook',

  '/api/integrations/garmin/cron',

  '/api/integrations/strava/callback',

  '/api/integrations/strava/webhook',

  '/api/integrations/strava/cron',

  '/api/integrations/healthkit/ingest',

  '/api/integrations/healthconnect/ingest',

  '/api/integrations/healthconnect/sleep-ingest',

  '/api/cron/cleanup-skipped-tombstones',

  '/api/cron/check-stale-pairings',

  '/api/public/snapshot',

] as const



/** @deprecated Use PUBLIC_API_ROUTES — kept for any external imports. */

export const PUBLIC_API_PREFIXES = PUBLIC_API_ROUTES



/**

 * True when pathname is an allowlisted public API route.

 * Matches exact path or `route + '/' + …` (segment boundary), never a longer

 * path segment that merely shares a prefix (`/api/health` ≠ `/api/health-debug`).

 */

export function isPublicApiRoute(pathname: string): boolean {

  return PUBLIC_API_ROUTES.some(

    (route) => pathname === route || pathname.startsWith(`${route}/`),

  )

}


