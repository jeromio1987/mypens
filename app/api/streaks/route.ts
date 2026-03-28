import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function calcStreak(dates: string[]): { current: number; longest: number; lastLogged: string | null } {
  if (!dates.length) return { current: 0, longest: 0, lastLogged: null }
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const todayStr = today()
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const mostRecent = sorted[0]
  const anchorStart = mostRecent === todayStr || mostRecent === yesterdayStr ? mostRecent : null
  let current = 0
  if (anchorStart) {
    let cursor = anchorStart
    for (const d of sorted) {
      if (d === cursor) {
        current++
        const prev = new Date(cursor + 'T00:00:00')
        prev.setDate(prev.getDate() - 1)
        cursor = prev.toISOString().slice(0, 10)
      } else {
        break
      }
    }
  }
  let longest = 1
  let running = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00')
    prev.setDate(prev.getDate() - 1)
    if (sorted[i] === prev.toISOString().slice(0, 10)) {
      running++
      if (running > longest) longest = running
    } else {
      running = 1
    }
  }
  return { current, longest: Math.max(current, longest), lastLogged: mostRecent }
}

export async function GET() {
  try {
    const [weight, food, sleep, training, measurements] = await Promise.all([
      prisma.weightEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
      prisma.foodEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
      prisma.sleepEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
      prisma.trainingEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
      prisma.bodyMeasurement.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
    ])

    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toISOString().slice(0, 10)
    })

    const coverage = (dates: { date: string }[]) => {
      const set = new Set(dates.map(d => d.date))
      return Math.round((last30.filter(d => set.has(d)).length / 30) * 100)
    }

    return NextResponse.json({
      weight:       { ...calcStreak(weight.map(d => d.date)),       coverage: coverage(weight) },
      food:         { ...calcStreak(food.map(d => d.date)),         coverage: coverage(food) },
      sleep:        { ...calcStreak(sleep.map(d => d.date)),        coverage: coverage(sleep) },
      training:     { ...calcStreak(training.map(d => d.date)),     coverage: coverage(training) },
      measurements: { ...calcStreak(measurements.map(d => d.date)), coverage: coverage(measurements) },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to compute streaks' }, { status: 500 })
  }
}
