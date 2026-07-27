import type { HealthConnectSleepSession } from './api'

/**
 * Coarse HRV → 1–5 quality bands (tracking aid, not clinical).
 * Returns null when HRV is missing — never invent a 3 (P2 / WP 0.2).
 */
export function hrvToQuality(hrv?: number | null): number | null {
  if (hrv == null || !Number.isFinite(hrv)) return null
  if (hrv < 30) return 1
  if (hrv < 45) return 2
  if (hrv < 60) return 3
  if (hrv < 75) return 4
  return 5
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const HHMM = /^\d{2}:\d{2}$/
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Local HH:MM from an ISO timestamp (runtime local zone — prefer client fields on Vercel). */
export function isoToHhMm(iso: string): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Sleep night date = calendar day of wake (endTime).
 * Matches common wearable “night of” bookkeeping.
 */
export function wakeDateFromIso(endTime: string): string | null {
  const ms = Date.parse(endTime)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function calcHours(bedtime: string, wakeTime: string): number {
  const bed = toMinutes(bedtime)
  let wake = toMinutes(wakeTime)
  if (wake <= bed) wake += 24 * 60
  return parseFloat(((wake - bed) / 60).toFixed(2))
}

export type MappedSleepEntry = {
  date: string
  bedtime: string
  wakeTime: string
  hours: number
  quality: number | null
  hrv: number | null
  notes: string | null
  externalId: string
  source: 'healthconnect'
}

export function mapSleepSession(s: HealthConnectSleepSession): MappedSleepEntry | null {
  if (!s?.id || !s.startTime || !s.endTime) return null

  // Prefer device-local fields from the companion (server TZ is often UTC).
  const bedtime =
    typeof s.bedtime === 'string' && HHMM.test(s.bedtime) ? s.bedtime : isoToHhMm(s.startTime)
  const wakeTime =
    typeof s.wakeTime === 'string' && HHMM.test(s.wakeTime) ? s.wakeTime : isoToHhMm(s.endTime)
  const date =
    typeof s.date === 'string' && YMD.test(s.date) ? s.date : wakeDateFromIso(s.endTime)
  if (!bedtime || !wakeTime || !date) return null

  const startMs = Date.parse(s.startTime)
  const endMs = Date.parse(s.endTime)
  let hours: number
  if (typeof s.hours === 'number' && Number.isFinite(s.hours)) {
    hours = parseFloat(s.hours.toFixed(2))
  } else if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
    hours = parseFloat(((endMs - startMs) / 3_600_000).toFixed(2))
  } else {
    hours = calcHours(bedtime, wakeTime)
  }
  if (hours <= 0 || hours > 24) return null

  const hrv =
    s.hrvMs != null && Number.isFinite(s.hrvMs) && s.hrvMs > 0 ? Number(s.hrvMs) : null
  const quality = hrvToQuality(hrv)

  const parts = ['Health Connect']
  if (s.packageName) parts.push(s.packageName)
  if (s.title?.trim()) parts.push(s.title.trim())
  const notesBase = parts.join(' · ')
  const notes = s.notes?.trim() ? `${notesBase} — ${s.notes.trim()}` : notesBase

  return {
    date,
    bedtime,
    wakeTime,
    hours,
    quality,
    hrv,
    notes: notes.slice(0, 500),
    externalId: s.id,
    source: 'healthconnect',
  }
}
