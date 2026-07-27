import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scheduleCrossAppDailySnapshotRefresh } from '@/lib/crossAppWriter'

/** Parse "HH:MM" → total minutes since midnight */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Calculate sleep hours, crossing midnight if wake < bed */
function calcHours(bedtime: string, wakeTime: string): number {
  const bed = toMinutes(bedtime)
  let wake = toMinutes(wakeTime)
  if (wake <= bed) wake += 24 * 60 // crossed midnight
  return parseFloat(((wake - bed) / 60).toFixed(2))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, bedtime, wakeTime, quality, hrv, notes } = body

    if (!date || !bedtime || !wakeTime) {
      return NextResponse.json(
        { error: 'date, bedtime and wakeTime are required' },
        { status: 400 },
      )
    }

    const hours = calcHours(bedtime, wakeTime)
    const qualityVal =
      quality === null || quality === undefined || quality === ''
        ? null
        : Number(quality)

    const entry = await prisma.sleepEntry.upsert({
      where: { date },
      create: {
        date,
        bedtime,
        wakeTime,
        hours,
        quality: qualityVal,
        hrv: hrv ?? null,
        notes,
        source: 'manual',
      },
      update: {
        bedtime,
        wakeTime,
        hours,
        quality: qualityVal,
        hrv: hrv ?? null,
        notes,
        source: 'manual',
      },
    })

    scheduleCrossAppDailySnapshotRefresh(date)

    return NextResponse.json({ entry, hours })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const limitRaw = searchParams.get('limit')
    const limit = limitRaw
      ? Math.min(120, Math.max(1, Number(limitRaw) || 30))
      : 30

    const entries = await prisma.sleepEntry.findMany({
      where: date ? { date } : undefined,
      orderBy: { date: 'desc' },
      take: limit,
    })
    return NextResponse.json(entries)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, bedtime, wakeTime, quality, hrv, notes } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const existing = await prisma.sleepEntry.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const newBed  = bedtime   ?? existing.bedtime
    const newWake = wakeTime  ?? existing.wakeTime
    const hours   = calcHours(newBed, newWake)

    const entry = await prisma.sleepEntry.update({
      where: { id },
      data: {
        bedtime:  newBed,
        wakeTime: newWake,
        hours,
        ...(quality !== undefined && {
          quality: quality === null || quality === '' ? null : Number(quality),
        }),
        ...(hrv     !== undefined && { hrv: hrv === '' ? null : Number(hrv) }),
        ...(notes   !== undefined && { notes }),
        // Editing via API marks the night as manual so HC won't overwrite.
        source: 'manual',
      },
    })
    scheduleCrossAppDailySnapshotRefresh(entry.date)
    return NextResponse.json({ entry, hours })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    const row = await prisma.sleepEntry.findUnique({ where: { id }, select: { date: true } })
    await prisma.sleepEntry.delete({ where: { id } })
    if (row?.date) scheduleCrossAppDailySnapshotRefresh(row.date)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
