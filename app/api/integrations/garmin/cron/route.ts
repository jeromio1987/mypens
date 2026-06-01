import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncRecentActivities } from '@/lib/integrations/garmin/sync'
import { syncBodyComps } from '@/lib/integrations/garmin/bodyCompSync'
import { syncSleep } from '@/lib/integrations/garmin/sleepSync'

/**
 * Daily fallback sync. Pulls the last 7 days of Garmin activities and imports
 * them, deduping on (source, externalId). Intended to be invoked by an external
 * scheduler (Vercel cron, GitHub Actions, etc.) so missed Push notifications
 * never leave the log out of date.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header, OR
 *       `?secret=<CRON_SECRET>` query param. If CRON_SECRET is unset the
 *       endpoint refuses to run to avoid an unauthenticated import trigger.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get('secret') === secret
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const conn = await prisma.garminConnection.findUnique({ where: { userId: 'default' } })
  if (!conn) {
    return NextResponse.json({ ok: true, skipped: 'not connected' })
  }

  const url = new URL(request.url)
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') || 7)))

  try {
    const [activities, bodyComps, sleep] = await Promise.allSettled([
      syncRecentActivities(days),
      syncBodyComps(days),
      syncSleep(days),
    ])
    return NextResponse.json({
      ok: true,
      days,
      activities: activities.status === 'fulfilled' ? activities.value : { error: String(activities.reason) },
      bodyComps:  bodyComps.status  === 'fulfilled' ? bodyComps.value  : { error: String(bodyComps.reason)  },
      sleep:      sleep.status      === 'fulfilled' ? sleep.value      : { error: String(sleep.reason)      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export const GET = run
export const POST = run
