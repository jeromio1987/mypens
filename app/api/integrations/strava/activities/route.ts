import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { listRecentActivities } from '@/lib/integrations/strava/api'
import { mapActivityToDraft } from '@/lib/integrations/strava/mapping'

/** GET — fetch recent Strava activities and mark which have already been imported. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.max(1, Math.min(90, Number(searchParams.get('days') || 30)))

    const activities = await listRecentActivities(days)
    const drafts = activities.map(mapActivityToDraft)

    const ids = drafts.map(d => d.externalId)
    const existing = ids.length
      ? await prisma.trainingEntry.findMany({
          where: { source: 'strava', externalId: { in: ids } },
          select: { externalId: true },
        })
      : []
    const importedSet = new Set(existing.map(e => e.externalId).filter(Boolean) as string[])

    const items = drafts.map(d => ({ ...d, alreadyImported: importedSet.has(d.externalId) }))
    return NextResponse.json({ items })
  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Not connected to Strava' }, { status: 401 })
    }
    if (msg === 'STRAVA_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Strava token invalid — please reconnect' }, { status: 401 })
    }
    if (msg === 'STRAVA_RATE_LIMITED') {
      return NextResponse.json({ error: 'Strava rate limit hit — try again later' }, { status: 429 })
    }
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}
