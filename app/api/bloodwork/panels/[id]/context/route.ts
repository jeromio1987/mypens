import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildLabWearableContextPayload, inclusiveRangeEnding } from '@/lib/bloodworkWearableContext'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const WINDOW_DAYS = 10

/**
 * Sleep + training aggregates in a fixed window **ending** on the panel draw date.
 * Framed as context only (roadmap item 7).
 */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const panel = await prisma.bloodworkPanel.findUnique({
      where: { id },
      select: { id: true, drawDate: true },
    })
    if (!panel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const settings = await prisma.userSettings.findUnique({
      where: { id: 'default' },
      select: { labsWearableContextEnabled: true },
    })
    if (settings && !settings.labsWearableContextEnabled) {
      return NextResponse.json({
        enabled: false,
        reason: 'Wearable context is turned off in Settings.',
      })
    }

    const dates = inclusiveRangeEnding(panel.drawDate, WINDOW_DAYS)

    const [sleepRows, trainingRows] = await Promise.all([
      prisma.sleepEntry.findMany({
        where: { date: { in: dates } },
        select: { date: true, hours: true, quality: true, hrv: true },
        orderBy: { date: 'asc' },
      }),
      prisma.trainingEntry.findMany({
        where: { date: { in: dates } },
        select: { date: true, volume: true },
      }),
    ])

    const payload = buildLabWearableContextPayload({
      drawDate: panel.drawDate,
      windowDays: WINDOW_DAYS,
      sleepRows,
      trainingRows,
    })

    return NextResponse.json({ enabled: true, ...payload })
  } catch (e) {
    console.error('[bloodwork/context GET]', e)
    return NextResponse.json({ error: 'Failed to build context' }, { status: 500 })
  }
}
