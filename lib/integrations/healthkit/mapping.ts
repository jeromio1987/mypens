import { fmtDistance, fmtDuration, type DraftTrainingEntry } from '../_shared/draft'
import type { HealthkitWorkout } from './api'

const STRENGTH_TYPES = new Set([
  'traditionalStrengthTraining',
  'functionalStrengthTraining',
  'crossTraining',
  'mixedCardio',
])

function isoDate(iso: string): string {
  // Take the date component as-is; companion app is expected to send local dates.
  return iso.slice(0, 10)
}

function humanType(type: string): string {
  // camelCase → Title Case
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim()
}

export function mapWorkoutToDraft(w: HealthkitWorkout): DraftTrainingEntry {
  const isStrength = STRENGTH_TYPES.has(w.workoutActivityType)
  const niceType = humanType(w.workoutActivityType)
  const exercise = isStrength ? 'Strength training' : niceType

  const noteParts: string[] = []
  if (isStrength) noteParts.push('Strength')
  if (w.durationSec) noteParts.push(fmtDuration(w.durationSec))
  if (w.totalDistanceM && w.totalDistanceM > 0) noteParts.push(fmtDistance(w.totalDistanceM))
  if (w.averageHeartRate) noteParts.push(`avg HR ${Math.round(w.averageHeartRate)}`)
  if (w.totalEnergyKcal) noteParts.push(`${Math.round(w.totalEnergyKcal)} kcal`)
  if (w.sourceName) noteParts.push(w.sourceName)
  if (w.notes) noteParts.push(w.notes)

  return {
    date: isoDate(w.startDate),
    exercise,
    sets: 1,
    reps: 1,
    weightKg: 0,
    rpe: null,
    notes: noteParts.join(' · '),
    volume: 0,
    source: 'healthkit',
    externalId: w.uuid,
    externalUrl: '',
    externalRaw: JSON.stringify(w),
  }
}

/** Map a stored PushedWorkout row back into a draft for the review UI. */
export function pushedToDraft(p: {
  externalId: string
  date: string
  exercise: string
  notes: string | null
  raw: string
}): DraftTrainingEntry {
  return {
    date: p.date,
    exercise: p.exercise,
    sets: 1,
    reps: 1,
    weightKg: 0,
    rpe: null,
    notes: p.notes ?? '',
    volume: 0,
    source: 'healthkit',
    externalId: p.externalId,
    externalUrl: '',
    externalRaw: p.raw,
  }
}
