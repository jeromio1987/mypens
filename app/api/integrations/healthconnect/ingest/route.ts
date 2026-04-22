import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bearerFromRequest, verifyToken } from '@/lib/integrations/healthconnect/auth'
import { mapSessionToDraft } from '@/lib/integrations/healthconnect/mapping'
import type { HealthConnectExerciseSession } from '@/lib/integrations/healthconnect/api'

/**
 * POST { sessions: HealthConnectExerciseSession[], clientError?: string | null }
 * Authorization: Bearer <pairingToken>
 *
 * Companion Android app calls this to push exercise sessions. `clientError`,
 * when present, is the most recent background-sync failure the companion saw
 * on-device; we store it so the dashboard can warn even when the server side
 * was healthy. Sending `null` clears the previous report.
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
    const clientErrorRaw = body?.clientError
    const clientError =
      clientErrorRaw === null || clientErrorRaw === undefined
        ? clientErrorRaw
        : String(clientErrorRaw).slice(0, 500)

    if (sessions.length === 0) {
      // See HealthKit ingest for the rationale: empty + clientError signal
      // is a deliberate report/clear call and should return 200.
      if (clientError === undefined) {
        return NextResponse.json({ error: 'sessions array required' }, { status: 400 })
      }
      await applyClientError(token, clientError)
      return NextResponse.json({ ok: true, stored: 0, skipped: 0, clientErrorApplied: true })
    }

    let stored = 0
    let skipped = 0
    try {
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
  await prisma.healthConnectConnection.updateMany({
    where: { pairingToken: token },
    data:
      clientError === null
        ? { lastClientError: null, lastClientErrorAt: null }
        : { lastClientError: clientError, lastClientErrorAt: new Date() },
  })
}
