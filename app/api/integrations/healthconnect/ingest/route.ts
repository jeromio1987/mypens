import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bearerFromRequest, verifyToken } from '@/lib/integrations/healthconnect/auth'
import { mapSessionToDraft } from '@/lib/integrations/healthconnect/mapping'
import type { HealthConnectExerciseSession } from '@/lib/integrations/healthconnect/api'

/**
 * POST { sessions: HealthConnectExerciseSession[] }
 * Authorization: Bearer <pairingToken>
 */
export async function POST(request: Request) {
  try {
    const token = bearerFromRequest(request)
    if (!(await verifyToken(token))) {
      return NextResponse.json({ error: 'Invalid pairing token' }, { status: 401 })
    }

    const body = await request.json()
    const sessions: HealthConnectExerciseSession[] =
      Array.isArray(body?.sessions) ? body.sessions : []
    if (sessions.length === 0) {
      return NextResponse.json({ error: 'sessions array required' }, { status: 400 })
    }

    let stored = 0
    let skipped = 0
    for (const s of sessions) {
      if (!s?.id || !s.startTime || !s.exerciseType) {
        skipped++
        continue
      }
      const draft = mapSessionToDraft(s)
      try {
        await prisma.pushedWorkout.create({
          data: {
            source: 'healthconnect',
            externalId: draft.externalId,
            date: draft.date,
            exercise: draft.exercise,
            notes: draft.notes,
            durationSec: s.durationSec ?? 0,
            distanceM: s.totalDistanceM ?? 0,
            calories: s.totalEnergyKcal ?? 0,
            raw: draft.externalRaw,
          },
        })
        stored++
      } catch (e) {
        const code = (e as { code?: string })?.code
        if (code === 'P2002') skipped++
        else throw e
      }
    }

    return NextResponse.json({ ok: true, stored, skipped })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to ingest' }, { status: 500 })
  }
}
