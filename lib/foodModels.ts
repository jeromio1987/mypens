export interface MacroTotals {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
}

export interface DailyTargets {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

// Default targets — user can override via env or future settings page
export const DEFAULT_TARGETS: DailyTargets = {
  kcal: 2200,
  proteinG: 160,
  carbsG: 220,
  fatG: 70,
}

export function sumMacros(entries: MacroTotals[]): MacroTotals {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
      fiberG: acc.fiberG + e.fiberG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  )
}

export function pctOfTarget(value: number, target: number) {
  return Math.min(Math.round((value / target) * 100), 100)
}

export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_ORDER)[number]

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
  snack: '🍎 Snack',
}
