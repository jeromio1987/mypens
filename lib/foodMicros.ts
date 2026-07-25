/**
 * Micronutrient + soft tag helpers for FoodEntry (JSON string columns).
 * Only store keys that are actually present — never invent medical claims.
 */

export type FoodMicros = Record<string, number>

export type FoodTag =
  | 'high_protein'
  | 'high_fiber'
  | 'ultra_processed_guess'
  | 'plant_forward'
  | 'dairy'
  | 'contains_alcohol'

const KNOWN_MICRO_KEYS = [
  'sodiumMg',
  'potassiumMg',
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'vitaminCMg',
  'vitaminDMcg',
  'vitaminB12Mcg',
  'zincMg',
] as const

export type KnownMicroKey = (typeof KNOWN_MICRO_KEYS)[number]

export function parseMicrosJson(raw: string | null | undefined): FoodMicros {
  if (!raw) return {}
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
    const out: FoodMicros = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n) && n >= 0) out[k] = Math.round(n * 100) / 100
    }
    return out
  } catch {
    return {}
  }
}

export function parseTagsJson(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const o = JSON.parse(raw) as unknown
    if (!Array.isArray(o)) return []
    return o
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map(t => t.trim().slice(0, 40))
      .slice(0, 12)
  } catch {
    return []
  }
}

export function serializeMicros(m: FoodMicros | null | undefined): string | null {
  if (!m || Object.keys(m).length === 0) return null
  return JSON.stringify(m)
}

export function serializeTags(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null
  return JSON.stringify([...new Set(tags)].slice(0, 12))
}

/** Scale micros by portion factor (same as macros). */
export function scaleMicros(micros: FoodMicros, scale: number): FoodMicros {
  if (!Number.isFinite(scale) || scale === 1) return { ...micros }
  const out: FoodMicros = {}
  for (const [k, v] of Object.entries(micros)) {
    out[k] = Math.round(v * scale * 100) / 100
  }
  return out
}

export function sumMicros(list: FoodMicros[]): FoodMicros {
  const out: FoodMicros = {}
  for (const m of list) {
    for (const [k, v] of Object.entries(m)) {
      out[k] = Math.round(((out[k] ?? 0) + v) * 100) / 100
    }
  }
  return out
}

/** Soft display tags from macros / optional vision hints — not moralizing. */
export function inferFoodTags(input: {
  kcal: number
  proteinG: number
  fiberG: number
  name?: string
  visionTags?: string[]
}): string[] {
  const tags = new Set<string>()
  const kcal = Math.max(0, input.kcal)
  const protein = Math.max(0, input.proteinG)
  const fiber = Math.max(0, input.fiberG)
  const name = (input.name ?? '').toLowerCase()

  if (kcal > 0 && protein / (kcal / 100) >= 8) tags.add('high_protein')
  if (fiber >= 5) tags.add('high_fiber')
  if (/\b(chips|cookie|biscuit|candy|soda|cola|instant|nugget)\b/.test(name)) {
    tags.add('ultra_processed_guess')
  }
  if (/\b(tofu|tempeh|lentil|bean|chickpea|quinoa|oat)\b/.test(name)) {
    tags.add('plant_forward')
  }
  if (/\b(milk|yoghurt|yogurt|cheese|quark)\b/.test(name)) tags.add('dairy')
  if (/\b(beer|wine|vodka|whisky|cocktail)\b/.test(name)) tags.add('contains_alcohol')

  for (const t of input.visionTags ?? []) {
    const s = t.trim().toLowerCase().replace(/\s+/g, '_')
    if (s) tags.add(s.slice(0, 40))
  }
  return [...tags].slice(0, 12)
}

export const MICRO_LABELS: Record<string, string> = {
  sodiumMg: 'Sodium',
  potassiumMg: 'Potassium',
  calciumMg: 'Calcium',
  ironMg: 'Iron',
  magnesiumMg: 'Magnesium',
  vitaminCMg: 'Vitamin C',
  vitaminDMcg: 'Vitamin D',
  vitaminB12Mcg: 'B12',
  zincMg: 'Zinc',
}

export type SoftNutrientFlag = {
  id: string
  tone: 'info' | 'soft'
  message: string
}

/** Soft day-level flags — educational ledger, not coaching. */
export function softNutrientFlags(input: {
  fiberG: number
  proteinG: number
  proteinTarget: number
  micros: FoodMicros
}): SoftNutrientFlag[] {
  const flags: SoftNutrientFlag[] = []
  if (input.fiberG < 25) {
    flags.push({
      id: 'fiber_low',
      tone: 'soft',
      message: `Fiber logged ${Math.round(input.fiberG)}g — many adults aim near ~25g/day (context only).`,
    })
  }
  if (input.proteinTarget > 0 && input.proteinG < input.proteinTarget * 0.7) {
    flags.push({
      id: 'protein_below_cue',
      tone: 'info',
      message: `Protein ${Math.round(input.proteinG)}g vs soft cue ${input.proteinTarget}g.`,
    })
  }
  const na = input.micros.sodiumMg
  if (na != null && na > 2300) {
    flags.push({
      id: 'sodium_high',
      tone: 'info',
      message: `Sodium logged ~${Math.round(na)} mg — common daily reference is ~2300 mg (food labels vary).`,
    })
  }
  return flags
}
