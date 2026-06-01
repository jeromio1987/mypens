import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const days = await prisma.programmeDay.findMany({
      where: { programmeId: id },
      orderBy: { order: 'asc' },
      include: { exercises: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json(days)
  } catch {
    return NextResponse.json({ error: 'Failed to load days' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => null)) as {
      dayLabel?: string
    } | null
    const dayLabel = body?.dayLabel?.trim()
    if (!dayLabel) {
      return NextResponse.json({ error: 'dayLabel required' }, { status: 400 })
    }
    const max = await prisma.programmeDay.findFirst({
      where: { programmeId: id },
      orderBy: { order: 'desc' },
    })
    const nextOrder = max ? max.order + 1 : 0
    const day = await prisma.programmeDay.create({
      data: { programmeId: id, dayLabel, order: nextOrder },
      include: { exercises: true },
    })
    return NextResponse.json(day)
  } catch {
    return NextResponse.json({ error: 'Failed to add day' }, { status: 500 })
  }
}

/** Body: `{ orderedDayIds: string[] }` — must be a permutation of this programme's day ids. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const parsed = (await request.json().catch(() => null)) as { orderedDayIds?: unknown } | null
    const ordered = parsed?.orderedDayIds
    if (!Array.isArray(ordered) || ordered.length === 0) {
      return NextResponse.json({ error: 'orderedDayIds non-empty array required' }, { status: 400 })
    }
    if (!ordered.every((x): x is string => typeof x === 'string' && x.length > 0)) {
      return NextResponse.json({ error: 'orderedDayIds must be strings' }, { status: 400 })
    }

    const existing = await prisma.programmeDay.findMany({
      where: { programmeId: id },
      select: { id: true },
    })
    const idSet = new Set(existing.map(d => d.id))
    if (ordered.length !== idSet.size) {
      return NextResponse.json(
        { error: 'orderedDayIds must list each programme day exactly once' },
        { status: 400 },
      )
    }
    for (const oid of ordered) {
      if (!idSet.has(oid)) {
        return NextResponse.json({ error: 'unknown day id in orderedDayIds' }, { status: 400 })
      }
    }

    await prisma.$transaction(
      ordered.map((dayId, index) =>
        prisma.programmeDay.update({
          where: { id: dayId },
          data: { order: index },
        }),
      ),
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to reorder days' }, { status: 500 })
  }
}
