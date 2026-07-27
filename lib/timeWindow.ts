/**
 * Single source of truth for "today" and date windows (P9).
 *
 * Rules:
 * - Local calendar dates (yyyy-mm-dd), never UTC `toISOString()` for day identity.
 * - Noon-anchor (`T12:00:00`) for all date arithmetic — survives CET/CEST midnight drift.
 * - Every window sets BOTH `from` and `to` (inclusive).
 * - Two labels only: `rolling` (day decision) and `calendar` (Mon–Sun week).
 */

export type WindowLabel = 'rolling' | 'calendar'

export type DateWindow = {
  from: string
  to: string
  label: WindowLabel
  /** Inclusive day count (rolling 7 → 7, calendar week → 7). */
  days: number
  dates: string[]
}

/** yyyy-mm-dd from local calendar fields. */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse yyyy-mm-dd as local noon (avoids UTC midnight shifting the calendar day). */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function shiftDateStr(s: string, days: number): string {
  const d = fromDateStr(s)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

/** Local "today" — noon-anchored so 00:00–02:00 Brussels still matches the wall clock. */
export function today(now: Date = new Date()): string {
  return toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0))
}

function enumerate(from: string, to: string): string[] {
  const dates: string[] = []
  for (let d = fromDateStr(from); toDateStr(d) <= to; d.setDate(d.getDate() + 1)) {
    dates.push(toDateStr(d))
  }
  return dates
}

/**
 * Inclusive rolling window of `days` ending on `asOf` (default: today).
 * Example: rollingWindow(7, '2026-07-25') → 2026-07-19 .. 2026-07-25.
 */
export function rollingWindow(days: number, asOf?: string | Date): DateWindow {
  const n = Math.max(1, Math.floor(days))
  const to =
    asOf == null
      ? today()
      : typeof asOf === 'string'
        ? asOf
        : today(asOf)
  const from = shiftDateStr(to, -(n - 1))
  return { from, to, label: 'rolling', days: n, dates: enumerate(from, to) }
}

/** Monday of the ISO week containing `anchor` (local). */
export function mondayOf(anchor: Date | string = new Date()): string {
  const date = typeof anchor === 'string' ? fromDateStr(anchor) : new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
    12,
    0,
    0,
    0,
  )
  const dow = date.getDay() // 0 = Sun … 6 = Sat
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return toDateStr(date)
}

/** Calendar week Mon–Sun containing `anchor`. */
export function calendarWeek(anchor?: string | Date): DateWindow {
  const weekOf = mondayOf(anchor ?? new Date())
  const weekEnd = shiftDateStr(weekOf, 6)
  return {
    from: weekOf,
    to: weekEnd,
    label: 'calendar',
    days: 7,
    dates: enumerate(weekOf, weekEnd),
  }
}

/** Prisma-friendly inclusive date filter. */
export function windowWhere(w: Pick<DateWindow, 'from' | 'to'>): { gte: string; lte: string } {
  return { gte: w.from, lte: w.to }
}

/** Alias kept for weekDates consumers. */
export function weekBounds(anchor: Date | string = new Date()): { weekOf: string; weekEnd: string } {
  const w = calendarWeek(anchor)
  return { weekOf: w.from, weekEnd: w.to }
}
