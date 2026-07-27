/**
 * Single source of truth for "today" and date windows (P9).
 * JS twin of lib/timeWindow.ts — keep in sync.
 *
 * Rules:
 * - Local calendar dates (yyyy-mm-dd), never UTC toISOString() for day identity.
 * - Noon-anchor (T12:00:00) for all date arithmetic.
 * - Every window sets BOTH from and to (inclusive).
 * - Two labels only: rolling | calendar.
 */

/** yyyy-mm-dd from local calendar fields. */
export function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse yyyy-mm-dd as local noon. */
export function fromDateStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function shiftDateStr(s, days) {
  const d = fromDateStr(s)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

export function today(now = new Date()) {
  return toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0))
}

function enumerate(from, to) {
  const dates = []
  for (let d = fromDateStr(from); toDateStr(d) <= to; d.setDate(d.getDate() + 1)) {
    dates.push(toDateStr(d))
  }
  return dates
}

export function rollingWindow(days, asOf) {
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

export function mondayOf(anchor = new Date()) {
  const date =
    typeof anchor === 'string'
      ? fromDateStr(anchor)
      : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12, 0, 0, 0)
  const dow = date.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return toDateStr(date)
}

export function calendarWeek(anchor) {
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

export function windowWhere(w) {
  return { gte: w.from, lte: w.to }
}

export function weekBounds(anchor = new Date()) {
  const w = calendarWeek(anchor)
  return { weekOf: w.from, weekEnd: w.to }
}
