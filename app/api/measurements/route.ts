import { NextResponse } from 'next/server'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/db'

const PHOTO_PATH_RE = /^\/uploads\/measurements\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|heic)$/

/** Only accept photo paths produced by our own upload route. */
function sanitisePhotoPath(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string') return null
  if (!PHOTO_PATH_RE.test(raw)) return null
  return raw
}

/** Best-effort delete of a previously-stored upload. Silent on miss. */
async function unlinkUpload(photoPath: string | null | undefined) {
  if (!photoPath) return
  if (!PHOTO_PATH_RE.test(photoPath)) return // hard guard against traversal
  const full = path.join(process.cwd(), 'public', photoPath)
  try {
    await unlink(full)
  } catch (err) {
    // file may already be gone or never existed — non-fatal
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn('orphan unlink failed', photoPath, err)
    }
  }
}

/**
 * Race-safe: only unlink an old photo if NO measurement row currently
 * references it. Guards against the case where two concurrent writes both
 * read the same `oldPhoto` and one of them ends up writing it back —
 * unlinking unconditionally would corrupt the survivor.
 */
async function unlinkIfOrphaned(oldPhoto: string | null | undefined) {
  if (!oldPhoto) return
  if (!PHOTO_PATH_RE.test(oldPhoto)) return
  const stillReferenced = await prisma.bodyMeasurement.findFirst({
    where: { photoPath: oldPhoto },
    select: { id: true },
  })
  if (stillReferenced) return
  await unlinkUpload(oldPhoto)
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

    // If we're upserting and the new photoPath differs from the old one,
    // capture the old path so we can unlink after the DB commit.
    const existing = await prisma.bodyMeasurement.findUnique({ where: { date } })
    const oldPhoto = existing?.photoPath ?? null

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

    // Cleanup: photo was replaced or removed → delete old file IFF no row still references it.
    if (photoPath !== undefined && oldPhoto && oldPhoto !== cleanPhoto) {
      await unlinkIfOrphaned(oldPhoto)
    }

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

    const existing = await prisma.bodyMeasurement.findUnique({ where: { id } })
    const oldPhoto = existing?.photoPath ?? null
    const newPhoto = fields.photoPath !== undefined ? sanitisePhotoPath(fields.photoPath) : undefined

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
        ...(newPhoto !== undefined && { photoPath: newPhoto }),
      },
    })

    if (newPhoto !== undefined && oldPhoto && oldPhoto !== newPhoto) {
      await unlinkIfOrphaned(oldPhoto)
    }

    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    const existing = await prisma.bodyMeasurement.findUnique({ where: { id } })
    await prisma.bodyMeasurement.delete({ where: { id } })
    if (existing?.photoPath) {
      // After the row is gone, only unlink if no other row still references the same file.
      await unlinkIfOrphaned(existing.photoPath)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
