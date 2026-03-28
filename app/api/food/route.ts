import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      date,
      meal = 'snack',
      name,
      kcal = 0,
      proteinG = 0,
      carbsG = 0,
      fatG = 0,
      fiberG = 0,
      notes,
    } = body

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const entry = await prisma.foodEntry.create({
      data: { date, meal, name, kcal, proteinG, carbsG, fatG, fiberG, notes },
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

    const entries = await prisma.foodEntry.findMany({
      where: date ? { date } : undefined,
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
      take: date ? undefined : 100,
    })
    return NextResponse.json(entries)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, meal, name, kcal, proteinG, carbsG, fatG, fiberG, notes } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const entry = await prisma.foodEntry.update({
      where: { id },
      data: {
        ...(meal      !== undefined && { meal }),
        ...(name      !== undefined && { name }),
        ...(kcal      !== undefined && { kcal:     Number(kcal) }),
        ...(proteinG  !== undefined && { proteinG: Number(proteinG) }),
        ...(carbsG    !== undefined && { carbsG:   Number(carbsG) }),
        ...(fatG      !== undefined && { fatG:     Number(fatG) }),
        ...(fiberG    !== undefined && { fiberG:   Number(fiberG) }),
        ...(notes     !== undefined && { notes }),
      },
    })
    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await prisma.foodEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
