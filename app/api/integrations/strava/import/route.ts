import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface DraftItem {
  date: string
  exercise: string
  sets?: number
  reps?: number
  weightKg?: number
  rpe?: number | null
  notes?: string
  externalId: string
  externalUrl?: string
  externalRaw?: string
}

/** POST { items: DraftItem[] } — create TrainingEntry rows from approved Strava drafts. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const items: DraftItem[] = Array.isArray(body?.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 })
    }

    let created = 0
    let skipped = 0

    for (const it of items) {
      if (!it.date || !it.exercise || !it.externalId) {
        skipped++
        continue
      }
      const existing = await prisma.trainingEntry.findFirst({
        where: { source: 'strava', externalId: it.externalId },
        select: { id: true },
      })
      if (existing) {
        skipped++
        continue
      }
      const sets = Number(it.sets ?? 1)
      const reps = Number(it.reps ?? 1)
      const weightKg = Number(it.weightKg ?? 0)
      const volume = parseFloat((sets * reps * weightKg).toFixed(1))
      try {
        await prisma.trainingEntry.create({
          data: {
            date: it.date,
            exercise: it.exercise,
            sets,
            reps,
            weightKg,
            rpe: it.rpe != null ? Number(it.rpe) : null,
            notes: it.notes ?? null,
            volume,
            source: 'strava',
            externalId: it.externalId,
            externalUrl: it.externalUrl ?? null,
            externalRaw: it.externalRaw ?? null,
          },
        })
        created++
      } catch (e) {
        // Unique constraint on (source, externalId) — treat as already imported
        const code = (e as { code?: string })?.code
        if (code === 'P2002') {
          skipped++
        } else {
          throw e
        }
      }
    }

    await prisma.stravaConnection.updateMany({
      where: { userId: 'default' },
      data: { lastSyncAt: new Date() },
    })

    return NextResponse.json({ ok: true, created, skipped })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}
