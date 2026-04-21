import { prisma } from '@/lib/db'

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
}

/**
 * Upsert TrainingEntry rows from approved drafts. Dedupes by (source, externalId).
 * Returns counts of created and skipped entries.
 */
export async function importDrafts(source: string, items: DraftItem[]) {
  let created = 0
  let skipped = 0

  for (const it of items) {
    if (!it.date || !it.exercise || !it.externalId) {
      skipped++
      continue
    }
    const existing = await prisma.trainingEntry.findFirst({
      where: { source, externalId: it.externalId },
      select: { id: true },
    })
    if (existing) {
      skipped++
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
          source,
          externalId: it.externalId,
          externalUrl: it.externalUrl ?? null,
          externalRaw: it.externalRaw ?? null,
        },
      })
      created++
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'P2002') skipped++
      else throw e
    }
  }

  return { created, skipped }
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
