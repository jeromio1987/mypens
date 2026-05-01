// Streak math for the Anchor module. Pure functions over a sorted-asc
// list of RecoveryEntry rows. "Today" is the local-time yyyy-mm-dd string.

export interface RecoveryEntryLite {
  date: string
  alcoholDrinks: number
  cocaineUsed: boolean
  escortUsed: boolean
}

/** yyyy-mm-dd in the server's local time. */
export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Subtract n days from a yyyy-mm-dd string, return same format. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const ny = dt.getFullYear()
  const nm = String(dt.getMonth() + 1).padStart(2, '0')
  const nd = String(dt.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

/** Count clean days walking backwards from `today`. A day with no entry is
 * treated as clean (no use logged) — that matches reality: if you didn't
 * drink, you didn't have anything to log. The streak only resets when an
 * entry explicitly records a slip. */
function streakFor(
  entries: RecoveryEntryLite[],
  today: string,
  isSlip: (e: RecoveryEntryLite) => boolean,
): number {
  const byDate = new Map(entries.map(e => [e.date, e]))
  let cursor = today
  let n = 0
  // Hard cap to keep this O(years) safe.
  for (let i = 0; i < 365 * 5; i++) {
    const e = byDate.get(cursor)
    if (e && isSlip(e)) break
    n++
    cursor = shiftDate(cursor, -1)
  }
  return n
}

export interface StreakSet {
  alcoholFreeDays: number
  cocaineFreeDays: number
  escortFreeDays: number
  /** Min of the three — days where ALL three categories were clean. */
  compoundCleanDays: number
}

export function computeStreaks(entries: RecoveryEntryLite[], today: string = todayStr()): StreakSet {
  const a = streakFor(entries, today, e => e.alcoholDrinks > 0)
  const c = streakFor(entries, today, e => e.cocaineUsed)
  const s = streakFor(entries, today, e => e.escortUsed)
  return {
    alcoholFreeDays: a,
    cocaineFreeDays: c,
    escortFreeDays: s,
    compoundCleanDays: Math.min(a, c, s),
  }
}

/** Common milestone targets in days, used to render "X days to next milestone". */
export const MILESTONES = [7, 14, 30, 45, 60, 90, 180, 365]

export function nextMilestone(currentDays: number): { target: number; daysLeft: number } {
  for (const t of MILESTONES) {
    if (t > currentDays) return { target: t, daysLeft: t - currentDays }
  }
  // Beyond the last fixed milestone — round up to next 365.
  const target = Math.ceil((currentDays + 1) / 365) * 365
  return { target, daysLeft: target - currentDays }
}
