import { NextResponse } from 'next/server'
import { listRecentActivities } from '@/lib/integrations/garmin/api'
import { mapActivityToDraft } from '@/lib/integrations/garmin/mapping'
import { markAlreadyImported } from '@/lib/integrations/_shared/import'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.max(1, Math.min(30, Number(searchParams.get('days') || 14)))

    const activities = await listRecentActivities(days)
    const drafts = activities.map(mapActivityToDraft)
    const items = await markAlreadyImported('garmin', drafts)
    return NextResponse.json({ items })
  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Not connected to Garmin' }, { status: 401 })
    }
    if (msg === 'GARMIN_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Garmin token invalid — please reconnect' }, { status: 401 })
    }
    if (msg === 'GARMIN_RATE_LIMITED') {
      return NextResponse.json({ error: 'Garmin rate limit hit — try again later' }, { status: 429 })
    }
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}
