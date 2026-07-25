import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bearerFromRequest, verifyToken } from '@/lib/integrations/healthconnect/auth'
import { mapSessionToDraft } from '@/lib/integrations/healthconnect/mapping'
import type { HealthConnectExerciseSession } from '@/lib/integrations/healthconnect/api'
import { importDrafts, type DraftItem } from '@/lib/integrations/_shared/import'

/**
 * POST { sessions: HealthConnectExerciseSession[], clientError?: string | null }
 * Authorization: Bearer <pairingToken>
 *
 * Companion Android app calls this to push exercise sessions. `clientError`,
 * when present, is the most recent background-sync failure the companion saw
 * on-device; we store it so the dashboard can warn even when the server side
 * was healthy. Sending `null` clears the previous report.
 *
 * When HealthConnectConnection.autoImportOnIngest is true, newly accepted
 * sessions are promoted straight to TrainingEntry (same path as manual Import)
 * and never land in the review queue.
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
    // Missing key entirely → bad payload. Empty array → heartbeat / nothing new (OK).
    if (!Array.isArray(rawSessions)) {
      return NextResponse.json({ error: 'sessions array required' }, { status: 400 })
    }
    const sessions = rawSessions as HealthConnectExerciseSession[]

    const clientErrorRaw = (body as { clientError?: unknown }).clientError
    const clientError =
      clientErrorRaw === null || clientErrorRaw === undefined
        ? clientErrorRaw
        : String(clientErrorRaw).slice(0, 500)

    const conn = await prisma.healthConnectConnection.findUnique({
      where: { pairingToken: token! },
      select: { autoImportOnIngest: true },
    })
    const autoImport = Boolean(conn?.autoImportOnIngest)

    if (sessions.length === 0) {
      await applyClientError(token, clientError)
      await prisma.healthConnectConnection.updateMany({
        where: { pairingToken: token! },
        data: {
          lastSyncAt: new Date(),
          lastError: null,
          lastErrorAt: null,
        },
      })
      return NextResponse.json({
        ok: true,
        stored: 0,
        skipped: 0,
        read: 0,
        imported: 0,
        autoImport,
      })
    }

    const candidateIds = sessions
      .map(s => s?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    const skippedRows = candidateIds.length
      ? await prisma.skippedPushedWorkout.findMany({
          where: { source: 'healthconnect', externalId: { in: candidateIds } },
          select: { externalId: true },
        })
      : []
    const skippedSet = new Set(skippedRows.map(r => r.externalId))

    let stored = 0
    let skipped = 0
    let imported = 0
    const autoImportDrafts: DraftItem[] = []

    try {
      for (const s of sessions) {
        if (!s?.id || !s.startTime || !s.exerciseType) {
          skipped++
          continue
        }
        if (skippedSet.has(s.id)) {
          skipped++
          continue
        }
        const draft = mapSessionToDraft(s)
        if (autoImport) {
          autoImportDrafts.push({
            date: draft.date,
            exercise: draft.exercise,
            sets: draft.sets,
            reps: draft.reps,
            weightKg: draft.weightKg,
            rpe: draft.rpe,
            notes: draft.notes,
            externalId: draft.externalId,
            externalUrl: draft.externalUrl || undefined,
            externalRaw: draft.externalRaw,
          })
          continue
        }
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

      if (autoImport && autoImportDrafts.length > 0) {
        const result = await importDrafts('healthconnect', autoImportDrafts)
        imported = result.created
        skipped += result.skipped
        // "stored" mirrors non-auto path: newly accepted items this request.
        stored = result.created
        // Drop any leftover inbox rows for these ids (e.g. earlier manual-queue pushes).
        const ids = autoImportDrafts.map(d => d.externalId)
        await prisma.pushedWorkout.deleteMany({
          where: { source: 'healthconnect', externalId: { in: ids } },
        })
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

    return NextResponse.json({
      ok: true,
      stored,
      skipped,
      imported,
      autoImport,
    })
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
