import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncDailiesWellness } from '@/lib/integrations/garmin/dailiesSync'
import { requireOwner } from '@/lib/integrations/requireOwner'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/garmin/dailies-sync?days=30
 * Pull Garmin wellness dailies (steps + Active/Resting/Total kcal) into GarminDailyMetric.
 * Requires Garmin OAuth connected (reconnect via /integrations → Connect Garmin).
 * Smoke: curl -X POST -H "Authorization: Bearer $MOBILE_PENS_API_TOKEN" \
 *   "http://127.0.0.1:5000/api/integrations/garmin/dailies-sync?days=7"
 */
export async function POST(request: Request) {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    const conn = await prisma.garminConnection.findUnique({ where: { userId: 'default' } })
    if (!conn) {
      return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 })
    }
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') || 30)))
    const result = await syncDailiesWellness(days)
    return NextResponse.json({
      ok: true,
      upserted: result.upserted,
      skipped: result.skipped,
      ingested: result.upserted,
      days: result.days,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
