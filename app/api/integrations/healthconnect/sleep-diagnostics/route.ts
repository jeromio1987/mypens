import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getConnection } from '@/lib/integrations/healthconnect/auth'
import { requireOwner } from '@/lib/integrations/requireOwner'
import { rollingWindow, windowWhere } from '@/lib/timeWindow'

export const dynamic = 'force-dynamic'

/**
 * WP 0.1 — sleep sync chain diagnostics (one glance).
 * Owner session or mobile bearer.
 */
export async function GET() {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    const window30 = rollingWindow(30)
    const dateFilter = windowWhere(window30)
    const conn = await getConnection()

    const nights = await prisma.sleepEntry.findMany({
      where: { date: dateFilter },
      orderBy: { date: 'asc' },
      select: { date: true, hours: true, quality: true, hrv: true, notes: true, source: true },
    })

    const rows = nights.map((n) => {
      const notes = n.notes ?? ''
      const source =
        n.source === 'healthconnect' || n.source === 'garmin' || n.source === 'manual'
          ? n.source
          : /health\s*connect/i.test(notes)
            ? 'healthconnect'
            : /garmin/i.test(notes)
              ? 'garmin'
              : notes.trim()
                ? 'other'
                : 'unknown'
      return {
        date: n.date,
        hours: n.hours,
        quality: n.quality,
        hrv: n.hrv,
        source,
        notesPreview: notes.slice(0, 80) || null,
      }
    })

    const hcNights = rows.filter((r) => r.source === 'healthconnect').length
    const dates = rows.map((r) => r.date)

    return NextResponse.json({
      ok: true,
      window: {
        label: 'rolling' as const,
        from: window30.from,
        to: window30.to,
        days: window30.days,
      },
      pairing: {
        connected: Boolean(conn),
        deviceLabel: conn?.deviceLabel ?? null,
        lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
        lastError: conn?.lastError ?? null,
        lastErrorAt: conn?.lastErrorAt?.toISOString() ?? null,
        lastClientError: conn?.lastClientError ?? null,
        lastClientErrorAt: conn?.lastClientErrorAt?.toISOString() ?? null,
      },
      sleep: {
        nightsLogged: rows.length,
        healthConnectNights: hcNights,
        firstDate: dates[0] ?? null,
        lastDate: dates[dates.length - 1] ?? null,
        gaps: countGaps(dates, window30.dates),
        rows,
      },
    })
  } catch (err) {
    console.error('[sleep-diagnostics]', err)
    return NextResponse.json({ error: 'Failed to build sleep diagnostics' }, { status: 500 })
  }
}

function countGaps(logged: string[], windowDates: string[]): number {
  const set = new Set(logged)
  return windowDates.filter((d) => !set.has(d)).length
}
