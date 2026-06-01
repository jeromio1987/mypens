import { NextResponse } from 'next/server'
import { unlink } from 'node:fs/promises'
import * as nodePath from 'node:path'
import { prisma } from '@/lib/db'
import { scheduleCrossAppDailySnapshotRefresh } from '@/lib/crossAppWriter'
import { sanitiseJournalVoicePath } from '@/lib/journalVoicePath'

function parseLimit(request: Request, fallback: number, cap: number): number {
  const raw = new URL(request.url).searchParams.get('limit')
  if (raw == null || raw === '') return fallback
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(cap, Math.max(1, n))
}

async function unlinkJournalVoiceFile(rel: string | null) {
  const safe = rel ? sanitiseJournalVoicePath(rel) : null
  if (!safe) return
  try {
    await unlink(nodePath.join(process.cwd(), 'public', safe))
  } catch {
    // non-fatal
  }
}

/** Last journal entries by calendar date descending (`limit` query, default 30, max 120). */
export async function GET(request: Request) {
  try {
    const take = parseLimit(request, 30, 120)
    const entries = await prisma.journalEntry.findMany({
      orderBy: { date: 'desc' },
      take,
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

    const hasVoiceKey = Object.prototype.hasOwnProperty.call(body, 'voicePath')
    let voicePath: string | null | undefined
    let voiceDurationSec: number | null | undefined
    if (hasVoiceKey) {
      const raw = body.voicePath
      const cleaned = sanitiseJournalVoicePath(raw)
      if (raw != null && raw !== '' && !cleaned) {
        return NextResponse.json({ error: 'invalid voicePath' }, { status: 400 })
      }
      voicePath = cleaned
      voiceDurationSec = cleaned
        ? typeof body.voiceDurationSec === 'number' && Number.isFinite(body.voiceDurationSec)
          ? Math.min(3600, Math.max(1, Math.floor(body.voiceDurationSec)))
          : null
        : null
    }

    const existing = await prisma.journalEntry.findUnique({ where: { date } })

    const entry = await prisma.journalEntry.upsert({
      where: { date },
      create: {
        date,
        title: title?.trim?.() ? String(title).trim() : null,
        content: content.trim(),
        mood: moodNum,
        notes: notes?.trim?.() ? String(notes).trim() : null,
        voicePath: hasVoiceKey ? (voicePath ?? null) : null,
        voiceDurationSec: hasVoiceKey ? (voiceDurationSec ?? null) : null,
      },
      update: {
        title: title?.trim?.() ? String(title).trim() : null,
        content: content.trim(),
        mood: moodNum,
        notes: notes?.trim?.() ? String(notes).trim() : null,
        ...(hasVoiceKey
          ? { voicePath: voicePath ?? null, voiceDurationSec: voiceDurationSec ?? null }
          : {}),
      },
    })

    const oldVoice = existing?.voicePath ?? null
    if (hasVoiceKey && oldVoice && oldVoice !== entry.voicePath) {
      await unlinkJournalVoiceFile(oldVoice)
    }

    scheduleCrossAppDailySnapshotRefresh(date)

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
    const row = await prisma.journalEntry.findUnique({ where: { id } })
    if (row?.voicePath) {
      await unlinkJournalVoiceFile(row.voicePath)
    }
    await prisma.journalEntry.delete({ where: { id } })
    if (row?.date) scheduleCrossAppDailySnapshotRefresh(row.date)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
