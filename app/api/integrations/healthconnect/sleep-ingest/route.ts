import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bearerFromRequest, verifyToken } from '@/lib/integrations/healthconnect/auth'
import { mapSleepSession, type MappedSleepEntry } from '@/lib/integrations/healthconnect/sleepMapping'
import type { HealthConnectSleepSession } from '@/lib/integrations/healthconnect/api'
import { scheduleCrossAppDailySnapshotRefresh } from '@/lib/crossAppWriter'

/**
 * POST { sessions: HealthConnectSleepSession[] }
 * Authorization: Bearer <pairingToken>
 *
 * Companion Android app pushes SleepSession records from Health Connect.
 * Upserts by wake-date; existing SleepEntry rows are skipped (manual / history wins).
 * Sleep lands directly in SleepEntry — not the workout review queue.
 */
export async function POST(request: Request) {
  try {
    const token = bearerFromRequest(request)
    if (!(await verifyToken(token))) {
      return NextResponse.json({ error: 'Invalid pairing token' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawSessions = (body as { sessions?: unknown }).sessions
    if (!Array.isArray(rawSessions)) {
      return NextResponse.json({ error: 'sessions array required' }, { status: 400 })
    }
    const sessions = rawSessions as HealthConnectSleepSession[]

    if (sessions.length === 0) {
      await prisma.healthConnectConnection.updateMany({
        where: { pairingToken: token! },
        data: {
          lastSyncAt: new Date(),
          lastError: null,
          lastErrorAt: null,
        },
      })
      return NextResponse.json({ ok: true, stored: 0, skipped: 0, read: 0 })
    }

    // One night per wake-date: keep the longest session if HC returns fragments.
    const byDate = new Map<string, MappedSleepEntry>()
    for (const raw of sessions) {
      const mapped = mapSleepSession(raw)
      if (!mapped) continue
      const prev = byDate.get(mapped.date)
      if (!prev || mapped.hours > prev.hours) byDate.set(mapped.date, mapped)
    }

    const dates = [...byDate.keys()]
    const existing = dates.length
      ? await prisma.sleepEntry.findMany({
          where: { date: { in: dates } },
          select: { date: true },
        })
      : []
    const existingSet = new Set(existing.map(e => e.date))

    let stored = 0
    let skipped = 0
    const touchedDates: string[] = []

    try {
      for (const mapped of byDate.values()) {
        if (existingSet.has(mapped.date)) {
          skipped++
          continue
        }
        await prisma.sleepEntry.create({
          data: {
            date: mapped.date,
            bedtime: mapped.bedtime,
            wakeTime: mapped.wakeTime,
            hours: mapped.hours,
            quality: mapped.quality,
            hrv: mapped.hrv,
            notes: mapped.notes,
          },
        })
        stored++
        touchedDates.push(mapped.date)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await prisma.healthConnectConnection.updateMany({
        where: { pairingToken: token! },
        data: { lastError: message.slice(0, 500), lastErrorAt: new Date() },
      })
      throw e
    }

    await prisma.healthConnectConnection.updateMany({
      where: { pairingToken: token! },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    })

    for (const d of touchedDates) {
      scheduleCrossAppDailySnapshotRefresh(d)
    }

    return NextResponse.json({
      ok: true,
      stored,
      skipped,
      read: sessions.length,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to ingest sleep' }, { status: 500 })
  }
}
