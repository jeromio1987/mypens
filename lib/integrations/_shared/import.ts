import { prisma } from '@/lib/db'
import {
  extractKcalFromExternalRaw,
  extractKcalFromNotes,
} from '@/lib/energyKcalExtract'

export interface DraftItem {
  date: string
  exercise: string
  sets?: number
  reps?: number
  weightKg?: number
  rpe?: number | null
  notes?: string
  externalId: string
  externalUrl?: string
  externalRaw?: string
  /** Structured session active kcal when known (Garmin/Strava/HC). */
  calories?: number | null
}

function resolveDraftCalories(it: DraftItem): number | null {
  if (it.calories != null && Number.isFinite(it.calories) && it.calories > 0) {
    return Math.round(it.calories)
  }
  const fromRaw = extractKcalFromExternalRaw(it.externalRaw)
  if (fromRaw != null) return fromRaw
  return extractKcalFromNotes(it.notes)
}

/**
 * Upsert TrainingEntry rows from approved drafts. Dedupes by (source, externalId).
 * Create-only was the old behaviour; we now update when kcal/raw arrives later
 * so Fuel does not stay stuck at Activity 0.
 */
export async function importDrafts(source: string, items: DraftItem[]) {
  let created = 0
  let updated = 0
  let skipped = 0

  for (const it of items) {
    if (!it.date || !it.exercise || !it.externalId) {
      skipped++
      continue
    }
    const calories = resolveDraftCalories(it)
    const existing = await prisma.trainingEntry.findFirst({
      where: { source, externalId: it.externalId },
      select: {
        id: true,
        calories: true,
        notes: true,
        externalRaw: true,
        exercise: true,
      },
    })

    if (existing) {
      const oldCal = existing.calories != null && existing.calories > 0 ? existing.calories : 0
      const newCal = calories ?? 0
      const kcalImproved = newCal > 0 && (oldCal === 0 || newCal !== oldCal)
      const rawImproved =
        Boolean(it.externalRaw) &&
        (!existing.externalRaw ||
          (it.externalRaw !== existing.externalRaw && newCal > 0 && oldCal === 0))
      const notesImproved =
        Boolean(it.notes) &&
        (!existing.notes || (kcalImproved && it.notes !== existing.notes))

      if (!kcalImproved && !rawImproved && !notesImproved) {
        skipped++
        continue
      }

      await prisma.trainingEntry.update({
        where: { id: existing.id },
        data: {
          ...(newCal > 0 ? { calories: newCal } : {}),
          ...(it.notes != null ? { notes: it.notes } : {}),
          ...(it.externalRaw != null ? { externalRaw: it.externalRaw } : {}),
          ...(it.externalUrl != null ? { externalUrl: it.externalUrl } : {}),
          ...(it.exercise ? { exercise: it.exercise } : {}),
          ...(it.date ? { date: it.date } : {}),
        },
      })
      updated++
      continue
    }

    const sets = Number(it.sets ?? 1)
    const reps = Number(it.reps ?? 1)
    const weightKg = Number(it.weightKg ?? 0)
    const volume = parseFloat((sets * reps * weightKg).toFixed(1))
    try {
      await prisma.trainingEntry.create({
        data: {
          date: it.date,
          exercise: it.exercise,
          sets,
          reps,
          weightKg,
          rpe: it.rpe != null ? Number(it.rpe) : null,
          notes: it.notes ?? null,
          volume,
          calories: calories,
          source,
          externalId: it.externalId,
          externalUrl: it.externalUrl ?? null,
          externalRaw: it.externalRaw ?? null,
        },
      })
      created++
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'P2002') {
        // Race: another writer created the row — try update path once.
        const race = await prisma.trainingEntry.findFirst({
          where: { source, externalId: it.externalId },
          select: { id: true, calories: true },
        })
        if (race && calories != null && calories > 0 && !(race.calories && race.calories > 0)) {
          await prisma.trainingEntry.update({
            where: { id: race.id },
            data: {
              calories,
              notes: it.notes ?? undefined,
              externalRaw: it.externalRaw ?? undefined,
            },
          })
          updated++
        } else {
          skipped++
        }
      } else {
        throw e
      }
    }
  }

  return { created, updated, skipped }
}

/** Annotate drafts with whether they've already been imported into TrainingEntry. */
export async function markAlreadyImported<T extends { externalId: string }>(
  source: string,
  drafts: T[],
): Promise<(T & { alreadyImported: boolean })[]> {
  const ids = drafts.map(d => d.externalId)
  const existing = ids.length
    ? await prisma.trainingEntry.findMany({
        where: { source, externalId: { in: ids } },
        select: { externalId: true },
      })
    : []
  const importedSet = new Set(existing.map(e => e.externalId).filter(Boolean) as string[])
  return drafts.map(d => ({ ...d, alreadyImported: importedSet.has(d.externalId) }))
}
