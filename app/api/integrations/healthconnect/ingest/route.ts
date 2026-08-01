import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bearerFromRequest, verifyToken } from '@/lib/integrations/healthconnect/auth'
import { isRawTypeLabel, mapSessionToDraft } from '@/lib/integrations/healthconnect/mapping'
import type { HealthConnectExerciseSession } from '@/lib/integrations/healthconnect/api'
import { importDrafts, type DraftItem } from '@/lib/integrations/_shared/import'

type DayMetricIn = {
  date?: string
  steps?: number
  activeKcal?: number
}

/**
 * HC day metrics land on side-kinds (`steps_hc` / `active_calories_hc`) so they
 * never overwrite Garmin `steps` / `active_calories` (D1). Readers resolve via
 * lib/dayMetricPrecedence.ts — Garmin wins when both exist.
 */
async function upsertDayMetrics(metrics: DayMetricIn[]): Promise<number> {
  let n = 0
  for (const m of metrics) {
    if (!m?.date || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) continue
    if (m.steps != null && Number.isFinite(m.steps) && m.steps > 0) {
      await prisma.garminDailyMetric.upsert({
        where: { date_kind: { date: m.date, kind: 'steps_hc' } },
        create: {
          date: m.date,
          kind: 'steps_hc',
          valueNum: Math.round(m.steps),
          unit: 'count',
          sourceFile: 'healthconnect',
          raw: JSON.stringify({ source: 'healthconnect', steps: m.steps }),
        },
        update: {
          valueNum: Math.round(m.steps),
          sourceFile: 'healthconnect',
          raw: JSON.stringify({ source: 'healthconnect', steps: m.steps }),
        },
      })
      n++
    }
    if (m.activeKcal != null && Number.isFinite(m.activeKcal) && m.activeKcal > 0) {
      await prisma.garminDailyMetric.upsert({
        where: { date_kind: { date: m.date, kind: 'active_calories_hc' } },
        create: {
          date: m.date,
          kind: 'active_calories_hc',
          valueNum: Math.round(m.activeKcal),
          unit: 'kcal',
          sourceFile: 'healthconnect',
          raw: JSON.stringify({ source: 'healthconnect', activeKcal: m.activeKcal }),
        },
        update: {
          valueNum: Math.round(m.activeKcal),
          sourceFile: 'healthconnect',
          raw: JSON.stringify({ source: 'healthconnect', activeKcal: m.activeKcal }),
        },
      })
      n++
    }
  }
  return n
}

/**
 * POST { sessions: HealthConnectExerciseSession[], dayMetrics?: [...], clientError?: string | null }
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
    const dayMetricsRaw = (body as { dayMetrics?: unknown }).dayMetrics
    const dayMetrics = Array.isArray(dayMetricsRaw) ? (dayMetricsRaw as DayMetricIn[]) : []

    const clientErrorRaw = (body as { clientError?: unknown }).clientError
    const clientError =
      clientErrorRaw === null || clientErrorRaw === undefined
        ? clientErrorRaw
        : String(clientErrorRaw).slice(0, 500)

    const conn = await prisma.healthConnectConnection.findUnique({
      where: { pairingToken: token! },
      select: { autoImportOnIngest: true },
    })
    const autoImport = conn ? Boolean(conn.autoImportOnIngest) : false

    if (sessions.length === 0 && dayMetrics.length === 0) {
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
        skippedAlreadyKnown: 0,
        needsLabel: 0,
        read: 0,
        imported: 0,
        autoImport,
        dayMetrics: 0,
      })
    }

    const dayMetricsUpserted = dayMetrics.length ? await upsertDayMetrics(dayMetrics) : 0

    if (sessions.length === 0) {
      await applyClientError(token, clientError)
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
        stored: 0,
        skipped: 0,
        skippedAlreadyKnown: 0,
        needsLabel: 0,
        read: 0,
        imported: 0,
        autoImport,
        dayMetrics: dayMetricsUpserted,
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
    let skippedAlreadyKnown = 0
    let needsLabel = 0
    let imported = 0
    const autoImportDrafts: DraftItem[] = []

    try {
      for (const s of sessions) {
        if (!s?.id || !s.startTime || !s.exerciseType) {
          skipped++
          skippedAlreadyKnown++
          continue
        }
        if (skippedSet.has(s.id)) {
          skipped++
          skippedAlreadyKnown++
          continue
        }
        const draft = mapSessionToDraft(s)
        const rawLabel = isRawTypeLabel(draft.exercise)
        const cal =
          draft.calories ??
          (s.totalEnergyKcal != null && s.totalEnergyKcal > 0 ? Math.round(s.totalEnergyKcal) : 0)

        // Always prefer updating an existing TrainingEntry (kcal backfill + label refresh).
        const existingTe = await prisma.trainingEntry.findFirst({
          where: { source: 'healthconnect', externalId: draft.externalId },
          select: { id: true, calories: true, notes: true, exercise: true },
        })
        if (existingTe) {
          const oldCal = existingTe.calories ?? 0
          const kcalImproved = cal > 0 && (oldCal === 0 || oldCal !== cal)
          const labelImproved =
            Boolean(draft.exercise) &&
            draft.exercise !== existingTe.exercise &&
            !isRawTypeLabel(draft.exercise)
          const notesImproved =
            Boolean(draft.notes) &&
            draft.notes !== existingTe.notes &&
            (kcalImproved || labelImproved)
          if (kcalImproved || labelImproved || notesImproved) {
            await prisma.trainingEntry.update({
              where: { id: existingTe.id },
              data: {
                ...(kcalImproved ? { calories: cal } : {}),
                ...(draft.notes != null ? { notes: draft.notes } : {}),
                ...(draft.externalRaw != null ? { externalRaw: draft.externalRaw } : {}),
                ...(labelImproved || kcalImproved ? { exercise: draft.exercise } : {}),
                ...(draft.date ? { date: draft.date } : {}),
              },
            })
            stored++
            if (isRawTypeLabel(draft.exercise) || isRawTypeLabel(existingTe.exercise)) {
              needsLabel++
            }
          } else {
            skipped++
            skippedAlreadyKnown++
            if (isRawTypeLabel(existingTe.exercise)) needsLabel++
          }
          continue
        }

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
            calories: draft.calories ?? (cal > 0 ? cal : null),
          })
          if (rawLabel) needsLabel++
          continue
        }
        const existing = await prisma.pushedWorkout.findUnique({
          where: {
            source_externalId: { source: 'healthconnect', externalId: draft.externalId },
          },
          select: { id: true, calories: true, exercise: true },
        })
        if (existing) {
          const oldCal = existing.calories ?? 0
          if (cal > 0 && (oldCal === 0 || cal !== oldCal)) {
            await prisma.pushedWorkout.update({
              where: { id: existing.id },
              data: {
                calories: cal,
                notes: draft.notes,
                raw: draft.externalRaw,
                durationSec: s.durationSec ?? 0,
                distanceM: s.totalDistanceM ?? 0,
                exercise: draft.exercise,
                date: draft.date,
              },
            })
            stored++
            if (rawLabel || isRawTypeLabel(existing.exercise)) needsLabel++
          } else {
            skipped++
            skippedAlreadyKnown++
            if (rawLabel || isRawTypeLabel(existing.exercise)) needsLabel++
          }
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
              calories: cal,
              raw: draft.externalRaw,
            },
          })
          stored++
          if (rawLabel) needsLabel++
        } catch (e) {
          const code = (e as { code?: string })?.code
          if (code === 'P2002') {
            skipped++
            skippedAlreadyKnown++
          } else throw e
        }
      }

      if (autoImport && autoImportDrafts.length > 0) {
        const result = await importDrafts('healthconnect', autoImportDrafts)
        imported = result.created
        skipped += result.skipped
        skippedAlreadyKnown += result.skipped
        stored = result.created + result.updated
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
        autoImportOnIngest: true,
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
      skippedAlreadyKnown,
      needsLabel,
      imported,
      autoImport: true,
      dayMetrics: dayMetricsUpserted,
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
