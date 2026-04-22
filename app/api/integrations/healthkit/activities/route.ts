import { NextResponse } from 'next/server'
import { listPendingWorkouts } from '@/lib/integrations/healthkit/api'
import { pushedToDraft } from '@/lib/integrations/healthkit/mapping'
import { markAlreadyImported } from '@/lib/integrations/_shared/import'
import { getConnection } from '@/lib/integrations/healthkit/auth'
import { prisma } from '@/lib/db'

const SOURCE = 'healthkit'

export async function GET(req: Request) {
  try {
    const conn = await getConnection()
    if (!conn) return NextResponse.json({ error: 'Not connected to Apple Health' }, { status: 401 })

    const url = new URL(req.url)
    const includeSkipped = url.searchParams.get('showSkipped') === '1'

    const pushed = await listPendingWorkouts()
    const drafts = pushed.map(pushedToDraft)
    const items = await markAlreadyImported(SOURCE, drafts)

    if (!includeSkipped) {
      return NextResponse.json({ items })
    }

    const skippedRows = await prisma.skippedPushedWorkout.findMany({
      where: { source: SOURCE },
      orderBy: { skippedAt: 'desc' },
      take: 200,
    })
    const skipped = skippedRows.map(s => ({
      externalId: s.externalId,
      skippedAt: s.skippedAt,
      date: s.date,
      exercise: s.exercise,
      notes: s.notes,
      source: SOURCE,
    }))
    return NextResponse.json({ items, skipped })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const conn = await getConnection()
    if (!conn) return NextResponse.json({ error: 'Not connected to Apple Health' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    let ids: string[] = []
    if (id) {
      ids = [id]
    } else {
      try {
        const body = await req.json()
        if (Array.isArray(body?.ids)) ids = body.ids.filter((x: unknown): x is string => typeof x === 'string')
      } catch {
        // no body
      }
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Provide ?id=<externalId> or a JSON body { ids: string[] }' },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Snapshot the rows we're about to delete so the tombstone keeps
      // enough info to display in the "Show skipped" list.
      const rows = await tx.pushedWorkout.findMany({
        where: { source: SOURCE, externalId: { in: ids } },
        select: { externalId: true, date: true, exercise: true, notes: true },
      })
      const snapshot = new Map(rows.map(r => [r.externalId, r]))
      const deleted = await tx.pushedWorkout.deleteMany({
        where: { source: SOURCE, externalId: { in: ids } },
      })
      for (const externalId of ids) {
        const snap = snapshot.get(externalId)
        await tx.skippedPushedWorkout.upsert({
          where: { source_externalId: { source: SOURCE, externalId } },
          create: {
            source: SOURCE,
            externalId,
            date: snap?.date ?? null,
            exercise: snap?.exercise ?? null,
            notes: snap?.notes ?? null,
          },
          update: {
            skippedAt: new Date(),
            ...(snap ? { date: snap.date, exercise: snap.exercise, notes: snap.notes } : {}),
          },
        })
      }
      return deleted
    })
    return NextResponse.json({ deleted: result.count })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete activities' }, { status: 500 })
  }
}

/**
 * Un-skip: remove tombstones so the next companion sync can re-ingest these
 * workouts. Body: { ids: string[] }.
 */
export async function POST(req: Request) {
  try {
    const conn = await getConnection()
    if (!conn) return NextResponse.json({ error: 'Not connected to Apple Health' }, { status: 401 })

    let ids: string[] = []
    try {
      const body = await req.json()
      if (Array.isArray(body?.ids)) ids = body.ids.filter((x: unknown): x is string => typeof x === 'string')
    } catch {
      // no body
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Provide a JSON body { ids: string[] }' }, { status: 400 })
    }

    const result = await prisma.skippedPushedWorkout.deleteMany({
      where: { source: SOURCE, externalId: { in: ids } },
    })
    return NextResponse.json({ unskipped: result.count })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to un-skip activities' }, { status: 500 })
  }
}
