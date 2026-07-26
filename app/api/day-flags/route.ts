import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const FOOD_INCOMPLETE = 'food_incomplete'

function parseTags(raw: string | null | undefined): string[] {
  try {
    const p = JSON.parse(raw || '[]')
    return Array.isArray(p) ? p.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

/** GET /api/day-flags?date=yyyy-mm-dd — foodIncomplete from DayEntry.tags */
export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date=yyyy-mm-dd required' }, { status: 400 })
    }
    const entry = await prisma.dayEntry.findUnique({ where: { date } })
    const tags = parseTags(entry?.tags)
    return NextResponse.json({
      date,
      foodIncomplete: tags.includes(FOOD_INCOMPLETE),
      mode: entry?.mode ?? null,
      tags,
    })
  } catch (e) {
    console.error('[day-flags GET]', e)
    return NextResponse.json({ error: 'Failed to load flags' }, { status: 500 })
  }
}

/** POST { date, foodIncomplete: boolean } — upserts DayEntry tag without wiping mode */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      date?: string
      foodIncomplete?: boolean
    } | null
    const date = body?.date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date=yyyy-mm-dd required' }, { status: 400 })
    }
    const foodIncomplete = Boolean(body?.foodIncomplete)
    const existing = await prisma.dayEntry.findUnique({ where: { date } })
    const tags = parseTags(existing?.tags).filter(t => t !== FOOD_INCOMPLETE)
    if (foodIncomplete) tags.push(FOOD_INCOMPLETE)

    const entry = await prisma.dayEntry.upsert({
      where: { date },
      create: {
        date,
        mode: 'balanced',
        tags: JSON.stringify(tags),
      },
      update: {
        tags: JSON.stringify(tags),
      },
    })

    return NextResponse.json({
      date,
      foodIncomplete,
      mode: entry.mode,
      tags: parseTags(entry.tags),
    })
  } catch (e) {
    console.error('[day-flags POST]', e)
    return NextResponse.json({ error: 'Failed to save flags' }, { status: 500 })
  }
}
