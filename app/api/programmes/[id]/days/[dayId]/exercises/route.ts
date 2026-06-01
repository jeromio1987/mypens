import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; dayId: string }>
  },
) {
  try {
    const { id, dayId } = await params
    const day = await prisma.programmeDay.findFirst({
      where: { id: dayId, programmeId: id },
    })
    if (!day) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 })
    }

    const parsed = await request.json().catch(() => null)
    const body =
      parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as {
            name?: string
            sets?: number
            reps?: string
            weightKg?: number | null
            order?: number
          })
        : null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const name = body.name?.trim()
    const sets =
      typeof body.sets === 'number' && !Number.isNaN(body.sets) ? Math.round(body.sets) : NaN
    const repsRaw = typeof body.reps === 'string' ? body.reps.trim() : ''

    if (!name || !Number.isFinite(sets) || sets < 1 || !repsRaw) {
      return NextResponse.json(
        { error: 'name, sets (positive int), reps (non-empty string) required' },
        { status: 400 },
      )
    }

    const maxEx = await prisma.programmeExercise.findFirst({
      where: { dayId },
      orderBy: { order: 'desc' },
    })
    const order =
      typeof body.order === 'number' && Number.isFinite(body.order)
        ? body.order
        : maxEx
          ? maxEx.order + 1
          : 0

    const ex = await prisma.programmeExercise.create({
      data: {
        dayId,
        name,
        sets,
        reps: repsRaw,
        weightKg: body.weightKg == null ? null : Number(body.weightKg),
        order,
      },
    })
    return NextResponse.json(ex)
  } catch {
    return NextResponse.json({ error: 'Failed to add exercise' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; dayId: string }>
  },
) {
  try {
    const { id, dayId } = await params
    const url = new URL(request.url)
    const exerciseId = url.searchParams.get('exerciseId')
    if (!exerciseId) {
      return NextResponse.json({ error: 'exerciseId query required' }, { status: 400 })
    }

    await prisma.programmeExercise.deleteMany({
      where: {
        id: exerciseId,
        day: {
          id: dayId,
          programmeId: id,
        },
      },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete exercise' }, { status: 500 })
  }
}

/** Body: `{ orderedExerciseIds: string[] }` — must be a permutation of this day's exercise ids. */
export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; dayId: string }>
  },
) {
  try {
    const { id, dayId } = await params
    const day = await prisma.programmeDay.findFirst({
      where: { id: dayId, programmeId: id },
      select: { id: true },
    })
    if (!day) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 })
    }

    const parsed = (await request.json().catch(() => null)) as { orderedExerciseIds?: unknown } | null
    const ordered = parsed?.orderedExerciseIds
    if (!Array.isArray(ordered) || ordered.length === 0) {
      return NextResponse.json({ error: 'orderedExerciseIds non-empty array required' }, { status: 400 })
    }
    if (!ordered.every((x): x is string => typeof x === 'string' && x.length > 0)) {
      return NextResponse.json({ error: 'orderedExerciseIds must be strings' }, { status: 400 })
    }

    const existing = await prisma.programmeExercise.findMany({
      where: { dayId },
      select: { id: true },
    })
    const idSet = new Set(existing.map(e => e.id))
    if (ordered.length !== idSet.size) {
      return NextResponse.json(
        { error: 'orderedExerciseIds must list each exercise exactly once' },
        { status: 400 },
      )
    }
    for (const oid of ordered) {
      if (!idSet.has(oid)) {
        return NextResponse.json({ error: 'unknown exercise id in orderedExerciseIds' }, { status: 400 })
      }
    }

    await prisma.$transaction(
      ordered.map((exerciseId, index) =>
        prisma.programmeExercise.update({
          where: { id: exerciseId },
          data: { order: index },
        }),
      ),
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to reorder exercises' }, { status: 500 })
  }
}
