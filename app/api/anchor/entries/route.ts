import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scheduleCrossAppDailySnapshotRefresh } from '@/lib/crossAppWriter'
import { todayStr } from '@/lib/anchor/streaks'

export const runtime = 'nodejs'

// GET /api/anchor/entries           → all entries (newest first)
// GET /api/anchor/entries?date=YYYY-MM-DD → that single day or null
export async function GET(req: Request) {
  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  if (date) {
    const entry = await prisma.recoveryEntry.findUnique({ where: { date } })
    return NextResponse.json(entry)
  }
  const all = await prisma.recoveryEntry.findMany({ orderBy: { date: 'desc' } })
  return NextResponse.json(all)
}

interface EntryPayload {
  date?: string
  alcoholDrinks?: number
  cocaineUsed?: boolean
  escortUsed?: boolean
  mood?: number | null
  energy?: number | null
  sleepHours?: number | null
  supplements?: string[]
  notes?: string | null
}

// POST upserts the day's entry.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EntryPayload
    const date = body.date || todayStr()
    const data = {
      alcoholDrinks: Math.max(0, Math.floor(body.alcoholDrinks ?? 0)),
      cocaineUsed: !!body.cocaineUsed,
      escortUsed: !!body.escortUsed,
      mood: body.mood ?? null,
      energy: body.energy ?? null,
      sleepHours: body.sleepHours ?? null,
      supplements: JSON.stringify(Array.isArray(body.supplements) ? body.supplements : []),
      notes: body.notes ?? null,
    }
    const entry = await prisma.recoveryEntry.upsert({
      where: { date },
      create: { date, ...data },
      update: data,
    })
    scheduleCrossAppDailySnapshotRefresh(date)
    return NextResponse.json(entry)
  } catch (err) {
    console.error('[anchor/entries POST]', err)
    return NextResponse.json({ error: 'failed to save' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { date } = (await req.json()) as { date: string }
    await prisma.recoveryEntry.delete({ where: { date } })
    scheduleCrossAppDailySnapshotRefresh(date)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'failed to delete' }, { status: 500 })
  }
}
