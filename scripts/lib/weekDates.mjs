// Small, dependency-free date helpers for the Weekly Feedback Loop.
// All dates are yyyy-mm-dd strings in local time, matching how the rest
// of MY PENS stores dates (see prisma models: `date String`).

/** yyyy-mm-dd for a Date in local time. */
export function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a yyyy-mm-dd string to a local Date (midnight). */
export function fromDateStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Shift a yyyy-mm-dd string by n days. */
export function shiftDateStr(s, days) {
  const d = fromDateStr(s)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

/**
 * Monday (ISO week start) of the week containing `d`.
 * Returns a yyyy-mm-dd string.
 */
export function mondayOf(d = new Date()) {
  const date = typeof d === 'string' ? fromDateStr(d) : new Date(d)
  const dow = date.getDay() // 0 = Sun … 6 = Sat
  const diff = dow === 0 ? -6 : 1 - dow // shift back to Monday
  date.setDate(date.getDate() + diff)
  return toDateStr(date)
}

/**
 * Given any anchor date (Date or yyyy-mm-dd), return the Monday..Sunday
 * bounds of that ISO week as { weekOf, weekEnd } yyyy-mm-dd strings.
 */
export function weekBounds(anchor = new Date()) {
  const weekOf = mondayOf(anchor)
  const weekEnd = shiftDateStr(weekOf, 6)
  return { weekOf, weekEnd }
}
