import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bearerFromRequest, verifyToken } from '@/lib/integrations/healthkit/auth'
import { mapWorkoutToDraft } from '@/lib/integrations/healthkit/mapping'
import type { HealthkitWorkout } from '@/lib/integrations/healthkit/api'

/**
 * POST { workouts: HealthkitWorkout[], clientError?: string | null }
 * Authorization: Bearer <pairingToken>
 *
 * Companion iOS app calls this to push workouts. Stored in PushedWorkout for
 * later review and promotion to TrainingEntry via /import.
 *
 * `clientError`, when present, is the most recent background-sync failure the
 * companion experienced on-device. We store it on the connection so the
 * dashboard can warn "your phone tried to sync and failed" even when no
 * server-side error occurred. Sending `null` clears any previous report.
 */
export async function POST(request: Request) {
  try {
    const token = bearerFromRequest(request)
    if (!(await verifyToken(token))) {
      return NextResponse.json({ error: 'Invalid pairing token' }, { status: 401 })
    }

    const body = await request.json()
    const workouts: HealthkitWorkout[] = Array.isArray(body?.workouts) ? body.workouts : []
    const clientErrorRaw = body?.clientError
    const clientError =
      clientErrorRaw === null || clientErrorRaw === undefined
        ? clientErrorRaw
        : String(clientErrorRaw).slice(0, 500)

    if (workouts.length === 0) {
      // Empty workouts is only an error if the caller has *nothing* to say.
      // A clear/report-only call carries the `clientError` field (string to
      // record, explicit `null` to clear) and is the documented way to push
      // status without any new sessions — return 200 so the companion
      // doesn't treat the response as a failure and stash a false retry.
      if (clientError === undefined) {
        return NextResponse.json({ error: 'workouts array required' }, { status: 400 })
      }
      await applyClientError(token, clientError)
      return NextResponse.json({ ok: true, stored: 0, skipped: 0, clientErrorApplied: true })
    }

    let stored = 0
    let skipped = 0
    try {
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
    } catch (e) {
      // Server-side failure — record on the connection so the badge surfaces
      // it. Re-throw so the request still 500s and the companion retries.
      const message = e instanceof Error ? e.message : String(e)
      await prisma.healthkitConnection.updateMany({
        where: { pairingToken: token! },
        data: { lastError: message.slice(0, 500), lastErrorAt: new Date() },
      })
      throw e
    }

    // Successful ingest — clear any previous server-side error and stamp the
    // last-sync timestamp. Apply the client's error report (or clear it).
    await prisma.healthkitConnection.updateMany({
      where: { pairingToken: token! },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
        ...(clientError === undefined
          ? {}
          : clientError === null
            ? { lastClientError: null, lastClientErrorAt: null }
            : { lastClientError: clientError, lastClientErrorAt: new Date() }),
      },
    })

    return NextResponse.json({ ok: true, stored, skipped })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to ingest' }, { status: 500 })
  }
}

async function applyClientError(token: string | null, clientError: string | null | undefined) {
  if (!token || clientError === undefined) return
  await prisma.healthkitConnection.updateMany({
    where: { pairingToken: token },
    data:
      clientError === null
        ? { lastClientError: null, lastClientErrorAt: null }
        : { lastClientError: clientError, lastClientErrorAt: new Date() },
  })
}
