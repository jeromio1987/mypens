import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Unified manual training + Garmin FIT imports for the activity stream page. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(60, Math.max(7, Number(searchParams.get('days')) || 21))
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().slice(0, 10)

    const [training, garmin] = await Promise.all([
      prisma.trainingEntry.findMany({
        where: { date: { gte: sinceStr } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 120,
      }),
      prisma.garminActivity.findMany({
        where: { date: { gte: sinceStr } },
        orderBy: { date: 'desc' },
        take: 80,
      }),
    ])

    const items = [
      ...training.map((t) => ({
        kind: 'training' as const,
        id: t.id,
        date: t.date,
        title: t.exercise,
        subtitle: `${t.sets}×${t.reps} @ ${t.weightKg} kg` + (t.volume ? ` · vol ${t.volume}` : ''),
        source: t.source,
        externalUrl: t.externalUrl,
        createdAt: t.createdAt.toISOString(),
      })),
      ...garmin.map((g) => ({
        kind: 'garmin_fit' as const,
        id: g.id,
        date: g.date,
        title: g.name,
        subtitle: `${g.sport}${g.distanceM ? ` · ${(g.distanceM / 1000).toFixed(1)} km` : ''}`,
        source: 'garmin_fit',
        externalUrl: null as string | null,
        createdAt: g.createdAt.toISOString(),
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)))

    return NextResponse.json({ since: sinceStr, items })
  } catch (error) {
    console.error('[activity-feed]', error)
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 })
  }
}
