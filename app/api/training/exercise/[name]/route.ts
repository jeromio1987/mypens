import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function buildSummary(entries: {
  date: string
  weightKg: number
  volume: number
}[]): {
  personalBestKg: number
  maxSessionVolume: number
  totalSessions: number
  firstDate: string
  lastDate: string
} {
  if (entries.length === 0) {
    return {
      personalBestKg: 0,
      maxSessionVolume: 0,
      totalSessions: 0,
      firstDate: '',
      lastDate: '',
    }
  }

  const personalBestKg = entries.reduce((m, e) => Math.max(m, e.weightKg), 0)

  const volByDay = new Map<string, number>()
  const sessionDates = new Set<string>()
  for (const e of entries) {
    sessionDates.add(e.date)
    volByDay.set(e.date, (volByDay.get(e.date) ?? 0) + e.volume)
  }
  const maxSessionVolume =
    volByDay.size === 0 ? 0 : Math.max(...volByDay.values())

  const datesSorted = [...sessionDates].sort((a, b) => a.localeCompare(b))

  return {
    personalBestKg: parseFloat(personalBestKg.toFixed(2)),
    maxSessionVolume: parseFloat(maxSessionVolume.toFixed(1)),
    totalSessions: sessionDates.size,
    firstDate: datesSorted[0] ?? '',
    lastDate: datesSorted[datesSorted.length - 1] ?? '',
  }
}

/** One row matching [name]; used when case-insensitive match returns mixed casing rows */
function pickRepresentativeExerciseName(rows: { exercise: string }[]): string {
  if (!rows.length) return ''
  const freq = new Map<string, number>()
  for (const r of rows) {
    freq.set(r.exercise, (freq.get(r.exercise) ?? 0) + 1)
  }
  let best = rows[0].exercise
  let bestCount = 0
  for (const [name, count] of freq) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await context.params
    const decoded = decodeURIComponent(name ?? '').trim()
    if (!decoded) {
      return NextResponse.json({ error: 'Exercise name required' }, { status: 400 })
    }

    const entries = await prisma.trainingEntry.findMany({
      where: { exercise: { equals: decoded, mode: 'insensitive' } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    })

    const summary = buildSummary(entries)
    const canonicalName = pickRepresentativeExerciseName(entries)

    return NextResponse.json({
      canonicalName,
      entries,
      summary,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
