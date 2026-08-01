/**
 * Scale diary macros when the user eats a fraction of a scanned pack.
 * Macros on a ScanItem are always for `assumedGrams` (AI serving / pack estimate).
 */

export type PortionableMacros = {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  /** Grams the macros currently describe (required for scaling). */
  assumedGrams: number | null
  /** Full package net weight when readable from label (optional). */
  packGrams: number | null
  brand?: string | null
  micros?: Record<string, number> | null
  tags?: string[] | null
  name?: string
  meal?: string
}

export function roundMacro(n: number, decimals = 1): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/**
 * Scale macros from assumedGrams → eatenGrams.
 * If assumedGrams is missing/0, returns originals unchanged.
 */
export function scalePortion<T extends PortionableMacros>(
  item: T,
  eatenGrams: number,
): T & { eatenGrams: number; scale: number } {
  const assumed = item.assumedGrams && item.assumedGrams > 0 ? item.assumedGrams : null
  const eaten = Math.max(0, Number(eatenGrams) || 0)
  const scale = assumed ? eaten / assumed : 1
  const micros =
    item.micros && Object.keys(item.micros).length > 0
      ? Object.fromEntries(
          Object.entries(item.micros).map(([k, v]) => [k, Math.round(v * scale * 100) / 100]),
        )
      : item.micros
  return {
    ...item,
    kcal: roundMacro(item.kcal * scale, 0),
    proteinG: roundMacro(item.proteinG * scale),
    carbsG: roundMacro(item.carbsG * scale),
    fatG: roundMacro(item.fatG * scale),
    fiberG: roundMacro(item.fiberG * scale),
    ...(micros ? { micros } : {}),
    eatenGrams: eaten,
    scale: roundMacro(scale, 3),
  }
}

/** Default eaten grams: prefer AI portion, else full pack, else 100. */
export function defaultEatenGrams(item: {
  assumedGrams?: number | null
  packGrams?: number | null
  portionGrams?: number | null
}): number {
  if (item.portionGrams && item.portionGrams > 0) return item.portionGrams
  if (item.assumedGrams && item.assumedGrams > 0) return item.assumedGrams
  if (item.packGrams && item.packGrams > 0) return item.packGrams
  return 100
}
