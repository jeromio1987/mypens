/** Scale diary macros when eating a fraction of a scanned pack (mobile copy). */

export type PortionableMacros = {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  assumedGrams: number | null
  packGrams: number | null
  brand?: string | null
  portionGrams?: number | null
}

function roundMacro(n: number, decimals = 1): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

export function scalePortion<T extends PortionableMacros>(item: T, eatenGrams: number) {
  const assumed = item.assumedGrams && item.assumedGrams > 0 ? item.assumedGrams : null
  const eaten = Math.max(0, Number(eatenGrams) || 0)
  const scale = assumed ? eaten / assumed : 1
  return {
    ...item,
    kcal: roundMacro(item.kcal * scale, 0),
    proteinG: roundMacro(item.proteinG * scale),
    carbsG: roundMacro(item.carbsG * scale),
    fatG: roundMacro(item.fatG * scale),
    fiberG: roundMacro(item.fiberG * scale),
    eatenGrams: eaten,
    scale: roundMacro(scale, 3),
  }
}

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
