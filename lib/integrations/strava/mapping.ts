import type { StravaActivity } from './api'

export interface DraftTrainingEntry {
  date: string         // yyyy-mm-dd in local time
  exercise: string
  sets: number
  reps: number
  weightKg: number
  rpe: number | null
  notes: string
  volume: number
  source: 'strava'
  externalId: string   // Strava activity id, optionally suffixed with `#<index>` for parsed sub-entries
  externalUrl: string
  externalRaw: string  // JSON of full payload
  /** Structured session kcal when Strava provides it (importDrafts prefers this). */
  calories?: number | null
}

const STRENGTH_TYPES = new Set(['WeightTraining', 'Crossfit', 'Workout'])
const LB_PER_KG = 2.20462

function isoDate(iso: string): string {
  // Use the local date portion (Strava provides start_date_local already in athlete-local time)
  return iso.slice(0, 10)
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`
  return `${Math.round(m)} m`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function toKg(value: number, unit: string | undefined): number {
  const u = (unit || 'kg').toLowerCase()
  if (u === 'lb' || u === 'lbs' || u === '#') return round1(value / LB_PER_KG)
  return round1(value)
}

export interface ParsedExerciseSet {
  exercise: string
  sets: number
  reps: number
  weightKg: number
}

/**
 * Parse a single description line into a structured set entry, or return null
 * if the line doesn't look like a strength set. Supported shapes (kg or lb/#):
 *   - "Bench Press 3x5 @ 100kg"
 *   - "Squat: 5x5x100"
 *   - "Pullups 3x10"           (bodyweight)
 *   - "3x5 @ 100kg Deadlift"
 *   - "5x5x225lb Front Squat"
 */
export function parseStrengthLine(raw: string): ParsedExerciseSet | null {
  const line = raw.trim().replace(/^[\s\-•*·]+/, '').replace(/^\d+[.)]\s+/, '')
  if (!line) return null

  // Pattern A: name first, then SxR, optional weight
  // e.g. "Bench Press 3x5 @ 100kg", "Squat: 5x5x100", "Pullups 3x10"
  const reA = /^(.+?)[\s:,\-–—]+(\d+)\s*[x×*]\s*(\d+)(?:\s*(?:[@x×*\-–—]|at)\s*(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs|#)?)?\s*$/i
  const a = line.match(reA)
  if (a) {
    const name = a[1].trim()
    const sets = parseInt(a[2], 10)
    const reps = parseInt(a[3], 10)
    const weightKg = a[4] ? toKg(parseFloat(a[4]), a[5]) : 0
    if (name && sets > 0 && reps > 0 && /[a-z]/i.test(name)) {
      return { exercise: name, sets, reps, weightKg }
    }
  }

  // Pattern B: SxR [@|x|-] W[unit] then name
  // e.g. "3x5 @ 100kg Deadlift", "5x5x225lb Front Squat"
  const reB = /^(\d+)\s*[x×*]\s*(\d+)(?:\s*(?:[@x×*\-–—]|at)\s*(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs|#)?)?\s+(.+)$/i
  const b = line.match(reB)
  if (b) {
    const sets = parseInt(b[1], 10)
    const reps = parseInt(b[2], 10)
    const weightKg = b[3] ? toKg(parseFloat(b[3]), b[4]) : 0
    const name = b[5].trim().replace(/^[@\-–—:,\s]+/, '').trim()
    if (name && sets > 0 && reps > 0 && /[a-z]/i.test(name)) {
      return { exercise: name, sets, reps, weightKg }
    }
  }

  return null
}

/** Parse a whole description (multi-line) into structured sets. */
export function parseStrengthDescription(desc: string | undefined | null): ParsedExerciseSet[] {
  if (!desc) return []
  const out: ParsedExerciseSet[] = []
  for (const line of desc.split(/\r?\n/)) {
    const parsed = parseStrengthLine(line)
    if (parsed) out.push(parsed)
  }
  return out
}

function summaryNotes(a: StravaActivity, isStrength: boolean): string {
  const parts: string[] = []
  if (a.moving_time) parts.push(fmtDuration(a.moving_time))
  if (a.distance && a.distance > 0) parts.push(fmtDistance(a.distance))
  if (a.total_elevation_gain && a.total_elevation_gain > 0) {
    parts.push(`↑ ${Math.round(a.total_elevation_gain)} m`)
  }
  if (a.average_heartrate) parts.push(`avg HR ${Math.round(a.average_heartrate)}`)
  if (a.calories) parts.push(`${Math.round(a.calories)} kcal`)
  if (isStrength) parts.unshift('Strength')
  return parts.join(' · ')
}

/**
 * Map a Strava activity to one or more draft training entries.
 *
 * For strength activities (WeightTraining / Crossfit / Workout) whose
 * description contains parseable per-exercise sets (e.g. "Bench 3x5 @ 100kg"),
 * one DraftTrainingEntry is emitted per exercise with real sets/reps/weight
 * and a computed volume. The activity id is suffixed with `#<index>` so each
 * row dedupes independently in the database.
 *
 * Otherwise (no parseable lines, or non-strength activity) a single summary
 * entry is returned, matching the previous behaviour.
 */
export function mapActivityToDraft(a: StravaActivity): DraftTrainingEntry[] {
  const isStrength = STRENGTH_TYPES.has(a.sport_type) || STRENGTH_TYPES.has(a.type)
  const date = isoDate(a.start_date_local || a.start_date)
  const externalUrl = `https://www.strava.com/activities/${a.id}`
  const externalRaw = JSON.stringify(a)

  if (isStrength) {
    const parsed = parseStrengthDescription(a.description)
    if (parsed.length > 0) {
      const titlePrefix = a.name?.trim() ? `${a.name.trim()} · ` : ''
      return parsed.map((p, i) => ({
        date,
        exercise: p.exercise,
        sets: p.sets,
        reps: p.reps,
        weightKg: p.weightKg,
        rpe: null,
        notes: `${titlePrefix}Strava strength`,
        volume: round1(p.sets * p.reps * p.weightKg),
        source: 'strava' as const,
        externalId: `${a.id}#${i}`,
        externalUrl,
        externalRaw,
      }))
    }
  }

  const exercise = isStrength
    ? (a.name?.trim() || 'Strength training')
    : `${a.sport_type || a.type}${a.name && a.name !== a.sport_type ? ` — ${a.name}` : ''}`

  const calories =
    a.calories != null && Number.isFinite(a.calories) && a.calories > 0
      ? Math.round(a.calories)
      : null

  return [{
    date,
    exercise,
    sets: 1,
    reps: 1,
    weightKg: 0,
    rpe: null,
    notes: summaryNotes(a, isStrength),
    volume: 0,
    source: 'strava',
    externalId: String(a.id),
    externalUrl,
    externalRaw,
    calories,
  }]
}
