import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, exercise, sets, reps, weightKg = 0, rpe, notes } = body

    if (!date || !exercise || !sets || !reps) {
      return NextResponse.json(
        { error: 'date, exercise, sets and reps are required' },
        { status: 400 },
      )
    }

    const volume = parseFloat((Number(sets) * Number(reps) * Number(weightKg)).toFixed(1))

    const entry = await prisma.trainingEntry.create({
      data: {
        date,
        exercise,
        sets: Number(sets),
        reps: Number(reps),
        weightKg: Number(weightKg),
        rpe: rpe ? Number(rpe) : null,
        notes,
        volume,
      },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    const entries = await prisma.trainingEntry.findMany({
      where: date ? { date } : undefined,
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
      take: date ? undefined : 300,
    })
    return NextResponse.json(entries)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await prisma.trainingEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
