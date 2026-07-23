/** yyyy-mm-dd helpers — TS copy of scripts/lib/weekDates.mjs for App Router. */

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function shiftDateStr(s: string, days: number): string {
  const d = fromDateStr(s)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

export function mondayOf(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? fromDateStr(d) : new Date(d)
  const dow = date.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return toDateStr(date)
}

export function weekBounds(anchor: Date | string = new Date()) {
  const weekOf = mondayOf(anchor)
  const weekEnd = shiftDateStr(weekOf, 6)
  return { weekOf, weekEnd }
}
