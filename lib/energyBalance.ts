import { prisma } from '@/lib/db'

export type EnergyActivitySource = {
  id: string
  label: string
  kcal: number
  origin: 'garmin_activity' | 'training' | 'notes'
  detail?: string
}

export type DayEnergyBalance = {
  date: string
  foodKcal: number
  activityKcal: number
  /** food − activity (positive = surplus vs logged burn; not TDEE) */
  delta: number
  incompleteCapture: boolean
  sources: EnergyActivitySource[]
  disclaimer: string
}

const DISCLAIMER =
  'Device / note estimates only — not metabolic TDEE. Food is what you logged; burn is what wearables reported.'

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
      (o as { calories?: number }).calories,
    ]
    for (const c of candidates) {
      const n = typeof c === 'number' ? c : Number(c)
      if (Number.isFinite(n) && n > 0) return n
    }
  } catch {
    /* ignore */
  }
  return null
}

export function extractKcalFromTraining(entry: {
  notes?: string | null
  externalRaw?: string | null
  exercise?: string
  id?: string
}): { kcal: number; origin: 'training' | 'notes' } | null {
  const fromRaw = extractKcalFromExternalRaw(entry.externalRaw)
  if (fromRaw != null) return { kcal: fromRaw, origin: 'training' }
  const fromNotes = extractKcalFromNotes(entry.notes)
  if (fromNotes != null) return { kcal: fromNotes, origin: 'notes' }
  return null
}

function roundKcal(n: number): number {
  return Math.round(n)
}

export async function getDayEnergyBalance(date: string): Promise<DayEnergyBalance> {
  const [foodAgg, garminActs, training] = await Promise.all([
    prisma.foodEntry.aggregate({
      where: { date },
      _sum: { kcal: true },
    }),
    prisma.garminActivity.findMany({
      where: { date },
      select: { id: true, name: true, sport: true, calories: true, distanceM: true, durationSec: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.trainingEntry.findMany({
      where: { date },
      select: { id: true, exercise: true, notes: true, externalRaw: true, source: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const foodKcal = roundKcal(foodAgg._sum.kcal ?? 0)
  const sources: EnergyActivitySource[] = []
  const hasGarminCals = garminActs.some(g => g.calories != null && g.calories > 0)

  for (const g of garminActs) {
    if (g.calories != null && g.calories > 0) {
      const dist =
        g.distanceM && g.distanceM > 500
          ? ` · ${(g.distanceM / 1000).toFixed(1)} km`
          : ''
      sources.push({
        id: `garmin:${g.id}`,
        label: g.name || g.sport || 'Garmin activity',
        kcal: roundKcal(g.calories),
        origin: 'garmin_activity',
        detail: `${g.sport || 'activity'}${dist}`,
      })
    }
  }

  for (const t of training) {
    const extracted = extractKcalFromTraining(t)
    if (!extracted) continue
    // Prefer GarminActivity archive calories over live garmin TrainingEntry duplicates
    if (t.source === 'garmin' && hasGarminCals) continue
    sources.push({
      id: `training:${t.id}`,
      label: t.exercise,
      kcal: roundKcal(extracted.kcal),
      origin: extracted.origin,
      detail: t.source !== 'manual' ? t.source : undefined,
    })
  }

  const activityKcal = roundKcal(sources.reduce((s, x) => s + x.kcal, 0))
  const incompleteCapture = activityKcal === 0 && training.length + garminActs.length > 0

  return {
    date,
    foodKcal,
    activityKcal,
    delta: roundKcal(foodKcal - activityKcal),
    incompleteCapture,
    sources,
    disclaimer: DISCLAIMER,
  }
}

export async function getEnergyBalanceRange(from: string, to: string): Promise<DayEnergyBalance[]> {
  const days: string[] = []
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  const out: DayEnergyBalance[] = []
  for (const date of days) {
    out.push(await getDayEnergyBalance(date))
  }
  return out
}
