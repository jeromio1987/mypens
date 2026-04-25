import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/** Only accept photo paths produced by our own upload route. */
function sanitisePhotoPath(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string') return null
  // Must be the exact public prefix, no traversal, no protocol.
  if (!/^\/uploads\/measurements\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|heic)$/.test(raw)) return null
  return raw
}

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
      photoPath,
    } = body

    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

    const toFloat = (v: unknown) => (v !== undefined && v !== '' && v !== null ? parseFloat(String(v)) : null)
    const cleanPhoto = sanitisePhotoPath(photoPath)
    if (photoPath != null && photoPath !== '' && cleanPhoto === null) {
      return NextResponse.json({ error: 'invalid photoPath' }, { status: 400 })
    }

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
        photoPath: cleanPhoto,
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
        ...(photoPath !== undefined && { photoPath: cleanPhoto }),
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
        ...(fields.photoPath    !== undefined && { photoPath: sanitisePhotoPath(fields.photoPath) }),
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
