/** Pull a kcal figure from training notes like "… · 1840 kcal · …" */
export function extractKcalFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null
  const m = notes.match(/(\d+(?:\.\d+)?)\s*kcal\b/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Prefer structured fields on raw Garmin / Strava / HC JSON blobs. */
export function extractKcalFromExternalRaw(raw: string | null | undefined): number | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const candidates = [
      o.activeKilocalories,
      o.calories,
      o.totalEnergyKcal,
      o.kilocalories,
    ]
    for (const c of candidates) {
      const n = typeof c === 'number' ? c : Number(c)
      if (Number.isFinite(n) && n > 0) return Math.round(n)
    }
  } catch {
    /* ignore */
  }
  return null
}

export type KcalOrigin = 'column' | 'training' | 'notes' | 'pushed'

/**
 * Prefer structured TrainingEntry.calories, then externalRaw, then notes scrape.
 */
export function extractKcalFromTraining(entry: {
  calories?: number | null
  notes?: string | null
  externalRaw?: string | null
  exercise?: string
  id?: string
}): { kcal: number; origin: KcalOrigin } | null {
  if (entry.calories != null && Number.isFinite(entry.calories) && entry.calories > 0) {
    return { kcal: Math.round(entry.calories), origin: 'column' }
  }
  const fromRaw = extractKcalFromExternalRaw(entry.externalRaw)
  if (fromRaw != null) return { kcal: fromRaw, origin: 'training' }
  const fromNotes = extractKcalFromNotes(entry.notes)
  if (fromNotes != null) return { kcal: fromNotes, origin: 'notes' }
  return null
}
