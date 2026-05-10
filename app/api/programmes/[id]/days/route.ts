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
