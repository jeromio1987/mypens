import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      date,
      waistCm,
      chestCm,
      hipsCm,
      leftArmCm,
      rightArmCm,
      leftThighCm,
      rightThighCm,
      neckCm,
      notes,
    } = body

    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

    const toFloat = (v: unknown) => (v !== undefined && v !== '' && v !== null ? parseFloat(String(v)) : null)

    const entry = await prisma.bodyMeasurement.upsert({
      where: { date },
      create: {
        date,
        waistCm: toFloat(waistCm),
        chestCm: toFloat(chestCm),
        hipsCm: toFloat(hipsCm),
        leftArmCm: toFloat(leftArmCm),
        rightArmCm: toFloat(rightArmCm),
        leftThighCm: toFloat(leftThighCm),
        rightThighCm: toFloat(rightThighCm),
        neckCm: toFloat(neckCm),
        notes: notes || null,
      },
      update: {
        waistCm: toFloat(waistCm),
        chestCm: toFloat(chestCm),
        hipsCm: toFloat(hipsCm),
        leftArmCm: toFloat(leftArmCm),
        rightArmCm: toFloat(rightArmCm),
        leftThighCm: toFloat(leftThighCm),
        rightThighCm: toFloat(rightThighCm),
        neckCm: toFloat(neckCm),
        notes: notes || null,
      },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const entries = await prisma.bodyMeasurement.findMany({
      orderBy: { date: 'desc' },
      take: 50,
    })
    return NextResponse.json(entries)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const toFloat = (v: unknown) => (v !== undefined && v !== '' && v !== null ? parseFloat(String(v)) : undefined)
    const entry = await prisma.bodyMeasurement.update({
      where: { id },
      data: {
        ...(fields.waistCm      !== undefined && { waistCm:      toFloat(fields.waistCm)      ?? null }),
        ...(fields.chestCm      !== undefined && { chestCm:      toFloat(fields.chestCm)      ?? null }),
        ...(fields.hipsCm       !== undefined && { hipsCm:       toFloat(fields.hipsCm)       ?? null }),
        ...(fields.leftArmCm    !== undefined && { leftArmCm:    toFloat(fields.leftArmCm)    ?? null }),
        ...(fields.rightArmCm   !== undefined && { rightArmCm:   toFloat(fields.rightArmCm)   ?? null }),
        ...(fields.leftThighCm  !== undefined && { leftThighCm:  toFloat(fields.leftThighCm)  ?? null }),
        ...(fields.rightThighCm !== undefined && { rightThighCm: toFloat(fields.rightThighCm) ?? null }),
        ...(fields.neckCm       !== undefined && { neckCm:       toFloat(fields.neckCm)       ?? null }),
        ...(fields.notes        !== undefined && { notes: fields.notes || null }),
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
    await prisma.bodyMeasurement.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
