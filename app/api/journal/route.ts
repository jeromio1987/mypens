import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/** Last 30 journal entries by calendar date descending */
export async function GET() {
  try {
    const entries = await prisma.journalEntry.findMany({
      orderBy: { date: 'desc' },
      take: 30,
    })
    return NextResponse.json(entries)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

/** Upsert one entry per day (same calendar date replaces row) */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, title, content, mood, notes } = body

    if (!date || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'date and non-empty content are required' }, { status: 400 })
    }

    const moodNum =
      mood === '' || mood == null ? null : typeof mood === 'number' ? mood : Number(mood)
    const moodOk = moodNum == null || (!Number.isNaN(moodNum) && moodNum >= 1 && moodNum <= 5)
    if (!moodOk) {
      return NextResponse.json({ error: 'mood must be between 1 and 5 when set' }, { status: 400 })
    }

    const entry = await prisma.journalEntry.upsert({
      where: { date },
      create: {
        date,
        title: title?.trim?.() ? String(title).trim() : null,
        content: content.trim(),
        mood: moodNum,
        notes: notes?.trim?.() ? String(notes).trim() : null,
      },
      update: {
        title: title?.trim?.() ? String(title).trim() : null,
        content: content.trim(),
        mood: moodNum,
        notes: notes?.trim?.() ? String(notes).trim() : null,
      },
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

/** Delete by id (?id=cuid…) */
export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query parameter required' }, { status: 400 })
    }
    await prisma.journalEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
