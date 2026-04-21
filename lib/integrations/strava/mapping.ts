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
  externalId: string   // Strava activity id (string for portability)
  externalUrl: string
  externalRaw: string  // JSON of full payload
}

const STRENGTH_TYPES = new Set(['WeightTraining', 'Crossfit', 'Workout'])

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

export function mapActivityToDraft(a: StravaActivity): DraftTrainingEntry {
  const isStrength = STRENGTH_TYPES.has(a.sport_type) || STRENGTH_TYPES.has(a.type)
  const exercise = isStrength
    ? (a.name?.trim() || 'Strength training')
    : `${a.sport_type || a.type}${a.name && a.name !== a.sport_type ? ` — ${a.name}` : ''}`

  const noteParts: string[] = []
  if (a.moving_time) noteParts.push(fmtDuration(a.moving_time))
  if (a.distance && a.distance > 0) noteParts.push(fmtDistance(a.distance))
  if (a.total_elevation_gain && a.total_elevation_gain > 0) {
    noteParts.push(`↑ ${Math.round(a.total_elevation_gain)} m`)
  }
  if (a.average_heartrate) noteParts.push(`avg HR ${Math.round(a.average_heartrate)}`)
  if (a.calories) noteParts.push(`${Math.round(a.calories)} kcal`)
  if (isStrength) noteParts.unshift('Strength')

  return {
    date: isoDate(a.start_date_local || a.start_date),
    exercise,
    sets: 1,
    reps: 1,
    weightKg: 0,
    rpe: null,
    notes: noteParts.join(' · '),
    volume: 0,
    source: 'strava',
    externalId: String(a.id),
    externalUrl: `https://www.strava.com/activities/${a.id}`,
    externalRaw: JSON.stringify(a),
  }
}
