/**
 * Mobile twin of lib/timeWindow.ts (P9).
 * Keep logic identical — Expo cannot import the web `lib/` tree.
 */

export type WindowLabel = 'rolling' | 'calendar'

export type DateWindow = {
  from: string
  to: string
  label: WindowLabel
  days: number
  dates: string[]
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function shiftDateStr(s: string, days: number): string {
  const d = fromDateStr(s)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

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

export function mondayOf(anchor: Date | string = new Date()): string {
  const date =
    typeof anchor === 'string'
      ? fromDateStr(anchor)
      : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12, 0, 0, 0)
  const dow = date.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return toDateStr(date)
}

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

export function windowWhere(w: Pick<DateWindow, 'from' | 'to'>): { gte: string; lte: string } {
  return { gte: w.from, lte: w.to }
}
