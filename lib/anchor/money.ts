// Money-saved calculator. Compares ACTUAL logged use against a personal
// baseline that the user sets in RecoverySettings. The baseline reflects
// pre-protocol consumption.

import type { RecoveryEntryLite } from './streaks'

export interface MoneySettings {
  drinkCostEur: number
  cocaineGramEur: number
  escortNightEur: number
  baselineDrinksPerWeek: number
  baselineCocaineGramsPerMonth: number
  baselineEscortsPerMonth: number
  resetStartDate: string
}

/**
 * Total money "saved" since `resetStartDate` until today (inclusive),
 * counting every day where actual use was below the baseline pro-rata.
 *
 * For alcohol: baseline is per WEEK, so we charge `baseline / 7` drinks
 * to each day that has no entry. Days with an entry use the entry's count.
 *
 * For cocaine + escorts: per-month baseline → `baseline / 30` per day.
 * Cocaine grams are estimated as 1g per "used" day (typical session size);
 * a future improvement could log grams explicitly.
 *
 * Days BEFORE resetStartDate don't count.
 */
export function computeMoneySaved(
  entries: RecoveryEntryLite[],
  s: MoneySettings,
  today: string,
): {
  alcoholEur: number
  cocaineEur: number
  escortEur: number
  totalEur: number
  daysCounted: number
} {
  // Build day-keyed map.
  const byDate = new Map(entries.map(e => [e.date, e]))

  // Walk every day from resetStartDate → today (inclusive).
  const days: string[] = []
  let cursor = s.resetStartDate
  // Safety: if reset date is in the future, no days yet.
  if (cursor > today) {
    return { alcoholEur: 0, cocaineEur: 0, escortEur: 0, totalEur: 0, daysCounted: 0 }
  }
  while (cursor <= today) {
    days.push(cursor)
    cursor = shift(cursor, 1)
    if (days.length > 365 * 10) break // safety
  }

  const baselineDrinksPerDay   = s.baselineDrinksPerWeek / 7
  const baselineCokeGramsPerDay = s.baselineCocaineGramsPerMonth / 30
  const baselineEscortsPerDay   = s.baselineEscortsPerMonth / 30

  let alcoholSaved = 0  // drinks avoided
  let cokeSaved    = 0  // grams avoided
  let escortSaved  = 0  // sessions avoided

  for (const d of days) {
    const e = byDate.get(d)
    const drinksToday = e?.alcoholDrinks ?? 0
    const cokeToday   = e?.cocaineUsed ? 1 : 0   // assume 1g on a use day
    const escortToday = e?.escortUsed ? 1 : 0

    alcoholSaved += Math.max(0, baselineDrinksPerDay - drinksToday)
    cokeSaved    += Math.max(0, baselineCokeGramsPerDay - cokeToday)
    escortSaved  += Math.max(0, baselineEscortsPerDay - escortToday)
  }

  const alcoholEur = alcoholSaved * s.drinkCostEur
  const cocaineEur = cokeSaved    * s.cocaineGramEur
  const escortEur  = escortSaved  * s.escortNightEur

  return {
    alcoholEur,
    cocaineEur,
    escortEur,
    totalEur: alcoholEur + cocaineEur + escortEur,
    daysCounted: days.length,
  }
}

function shift(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const ny = dt.getFullYear()
  const nm = String(dt.getMonth() + 1).padStart(2, '0')
  const nd = String(dt.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}
