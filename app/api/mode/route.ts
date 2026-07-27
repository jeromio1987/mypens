import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { shiftDateStr, today } from '@/lib/timeWindow'

async function getModeStreak(): Promise<number> {
  const todayStr = today()
  const yesterdayStr = shiftDateStr(todayStr, -1)
  const allEntries = await prisma.dayEntry.findMany({
    select: { date: true, mode: true },
    orderBy: { date: 'desc' },
  })
  const sorted = [...new Set(allEntries.filter(e => e.mode).map(e => e.date))].sort((a, b) => b.localeCompare(a))
  if (!sorted.length) return 0
  const mostRecent = sorted[0]
  const anchorStart = mostRecent === todayStr || mostRecent === yesterdayStr ? mostRecent : null
  if (!anchorStart) return 0
  let streak = 0
  let cursor = anchorStart
  for (const d of sorted) {
    if (d === cursor) {
      streak++
      cursor = shiftDateStr(cursor, -1)
    } else {
      break
    }
  }
  return streak
}

export async function GET() {
  try {
    const [entry, streak] = await Promise.all([
      prisma.dayEntry.findUnique({ where: { date: today() } }),
      getModeStreak(),
    ])
    if (!entry) return NextResponse.json({ mode: null, tags: [], streak })
    return NextResponse.json({ mode: entry.mode, tags: JSON.parse(entry.tags), streak })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load mode' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { mode, tags = [] } = await req.json()
    if (!['locked_in', 'balanced', 'off'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }
    const entry = await prisma.dayEntry.upsert({
      where: { date: today() },
      update: { mode, tags: JSON.stringify(tags) },
      create: { date: today(), mode, tags: JSON.stringify(tags) },
    })
    const streak = await getModeStreak()
    return NextResponse.json({ mode: entry.mode, tags: JSON.parse(entry.tags), streak })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save mode' }, { status: 500 })
  }
}
