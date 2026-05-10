import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Agg = {
  /** Display spelling — first row seen while scanning desc by date */
  exercise: string
  sessionDates: Set<string>
  /** Max weightKg in any logged row */
  personalBestKg: number
}

export async function GET() {
  try {
    const rows = await prisma.trainingEntry.findMany({
      select: { exercise: true, date: true, weightKg: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    const byKey = new Map<string, Agg>()
    for (const r of rows) {
      const key = r.exercise.trim().toLowerCase()
      let agg = byKey.get(key)
      if (!agg) {
        agg = {
          exercise: r.exercise,
          sessionDates: new Set<string>(),
          personalBestKg: r.weightKg,
        }
        byKey.set(key, agg)
      }
      agg.sessionDates.add(r.date)
      if (r.weightKg > agg.personalBestKg) agg.personalBestKg = r.weightKg
    }

    const list = [...byKey.values()]
      .map(a => ({
        exercise: a.exercise,
        sessionCount: a.sessionDates.size,
        lastDate: [...a.sessionDates].sort((x, y) => y.localeCompare(x))[0] ?? '',
        personalBestKg: parseFloat(a.personalBestKg.toFixed(2)),
      }))
      .sort((x, y) => y.lastDate.localeCompare(x.lastDate))

    return NextResponse.json(list)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
