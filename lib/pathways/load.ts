import { prisma } from '@/lib/db'
import { inferHints, scoreAllPathways, type DaySignals } from './strength'
import type { PathwayStrength } from './strength'

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Build last ~28 days of signals from Anchor recovery entries + cravings + sleep.
 * Soft tags (cold / scaffold / training) inferred from notes/supplements text.
 */
export async function loadPathwayDaySignals(): Promise<DaySignals[]> {
  const since = daysAgoISO(35)
  const [entries, cravings, sleeps] = await Promise.all([
    prisma.recoveryEntry.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
    }),
    prisma.cravingEvent.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 35 * 86400000) } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.sleepEntry.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
    }),
  ])

  const sleepByDate = new Map(sleeps.map((s) => [s.date, s.hours ?? null]))
  const craveByDate = new Map<
    string,
    { count: number; resisted: number; slipped: number }
  >()

  for (const c of cravings) {
    const date = c.createdAt.toISOString().slice(0, 10)
    const cur = craveByDate.get(date) ?? { count: 0, resisted: 0, slipped: 0 }
    cur.count++
    if (c.outcome === 'resisted') cur.resisted++
    if (c.outcome === 'slipped' || c.outcome === 'partial') cur.slipped++
    // action cold_shower counts as cold lever that day
    craveByDate.set(date, cur)
  }

  const coldFromCraving = new Set(
    cravings
      .filter((c) => c.action === 'cold_shower')
      .map((c) => c.createdAt.toISOString().slice(0, 10)),
  )

  const byDate = new Map<string, DaySignals>()

  for (const e of entries) {
    const hints = inferHints(e.notes, e.supplements)
    const cr = craveByDate.get(e.date) ?? { count: 0, resisted: 0, slipped: 0 }
    const sleepH = e.sleepHours ?? sleepByDate.get(e.date) ?? null
    byDate.set(e.date, {
      date: e.date,
      alcoholDrinks: e.alcoholDrinks,
      cocaineUsed: e.cocaineUsed,
      mood: e.mood,
      energy: e.energy,
      sleepHours: sleepH,
      cravingCount: cr.count,
      cravingResisted: cr.resisted,
      cravingSlipped: cr.slipped,
      coldHint: hints.coldHint || coldFromCraving.has(e.date),
      scaffoldHint: hints.scaffoldHint,
      trainingHint: hints.trainingHint,
    })
  }

  // Include craving-only days without recovery entry
  for (const [date, cr] of craveByDate) {
    if (byDate.has(date)) continue
    byDate.set(date, {
      date,
      alcoholDrinks: 0,
      cocaineUsed: false,
      mood: null,
      energy: null,
      sleepHours: sleepByDate.get(date) ?? null,
      cravingCount: cr.count,
      cravingResisted: cr.resisted,
      cravingSlipped: cr.slipped,
      coldHint: coldFromCraving.has(date),
      scaffoldHint: false,
      trainingHint: false,
    })
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function computePathwayStrengths(): Promise<{
  pathways: PathwayStrength[]
  daysAvailable: number
  dataLinked: boolean
}> {
  const days = await loadPathwayDaySignals()
  const pathways = scoreAllPathways(days)
  const dataLinked = pathways.some((p) => p.dataLinked)
  return { pathways, daysAvailable: days.length, dataLinked }
}
