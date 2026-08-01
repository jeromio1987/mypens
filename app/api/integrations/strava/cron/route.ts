import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncRecentActivities } from '@/lib/integrations/strava/sync'

/**
 * Daily fallback sync. Pulls the last 7 days of Strava activities and imports
 * them, deduping on (source, externalId). Intended to be invoked by an external
 * scheduler (Vercel cron, GitHub Actions, etc.).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (header only — query-param
 *       secrets land in proxy/CDN/Referer logs). If CRON_SECRET is unset the
 *       endpoint refuses to run to avoid an unauthenticated import trigger.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const conn = await prisma.stravaConnection.findUnique({ where: { userId: 'default' } })
  if (!conn) {
    return NextResponse.json({ ok: true, skipped: 'not connected' })
  }

  const url = new URL(request.url)
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') || 7)))

  try {
    const result = await syncRecentActivities(days)
    return NextResponse.json({ ok: true, ...result, days })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export const GET = run
export const POST = run
