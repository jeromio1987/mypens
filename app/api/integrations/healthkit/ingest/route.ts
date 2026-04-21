import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bearerFromRequest, verifyToken } from '@/lib/integrations/healthkit/auth'
import { mapWorkoutToDraft } from '@/lib/integrations/healthkit/mapping'
import type { HealthkitWorkout } from '@/lib/integrations/healthkit/api'

/**
 * POST { workouts: HealthkitWorkout[] }
 * Authorization: Bearer <pairingToken>
 *
 * Companion iOS app calls this to push workouts. Stored in PushedWorkout for
 * later review and promotion to TrainingEntry via /import.
 */
export async function POST(request: Request) {
  try {
    const token = bearerFromRequest(request)
    if (!(await verifyToken(token))) {
      return NextResponse.json({ error: 'Invalid pairing token' }, { status: 401 })
    }

    const body = await request.json()
    const workouts: HealthkitWorkout[] = Array.isArray(body?.workouts) ? body.workouts : []
    if (workouts.length === 0) {
      return NextResponse.json({ error: 'workouts array required' }, { status: 400 })
    }

    let stored = 0
    let skipped = 0
    for (const w of workouts) {
      if (!w?.uuid || !w.startDate || !w.workoutActivityType) {
        skipped++
        continue
      }
      const draft = mapWorkoutToDraft(w)
      try {
        await prisma.pushedWorkout.create({
          data: {
            source: 'healthkit',
            externalId: draft.externalId,
            date: draft.date,
            exercise: draft.exercise,
            notes: draft.notes,
            durationSec: w.durationSec ?? 0,
            distanceM: w.totalDistanceM ?? 0,
            calories: w.totalEnergyKcal ?? 0,
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
