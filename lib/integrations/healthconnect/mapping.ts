import { fmtDistance, fmtDuration, type DraftTrainingEntry } from '../_shared/draft'
import type { HealthConnectExerciseSession } from './api'

const STRENGTH_TYPES = new Set([
  'STRENGTH_TRAINING',
  'WEIGHTLIFTING',
  'CALISTHENICS',
  'CROSSFIT',
  'HIGH_INTENSITY_INTERVAL_TRAINING',
])

function isoDate(iso: string): string {
  return iso.slice(0, 10)
}

function humanType(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

export function mapSessionToDraft(s: HealthConnectExerciseSession): DraftTrainingEntry {
  const isStrength = STRENGTH_TYPES.has(s.exerciseType)
  const niceType = humanType(s.exerciseType)
  const exercise = isStrength
    ? (s.title?.trim() || 'Strength training')
    : (s.title?.trim() || niceType)

  const noteParts: string[] = []
  if (isStrength) noteParts.push('Strength')
  if (s.durationSec) noteParts.push(fmtDuration(s.durationSec))
  if (s.totalDistanceM && s.totalDistanceM > 0) noteParts.push(fmtDistance(s.totalDistanceM))
  if (s.averageHeartRate) noteParts.push(`avg HR ${Math.round(s.averageHeartRate)}`)
  if (s.totalEnergyKcal) noteParts.push(`${Math.round(s.totalEnergyKcal)} kcal`)
  if (s.packageName) noteParts.push(s.packageName)
  if (s.notes) noteParts.push(s.notes)

  const calories =
    s.totalEnergyKcal != null && s.totalEnergyKcal > 0
      ? Math.round(s.totalEnergyKcal)
      : null

  return {
    date: isoDate(s.startTime),
    exercise,
    sets: 1,
    reps: 1,
    weightKg: 0,
    rpe: null,
    notes: noteParts.join(' · '),
    volume: 0,
    source: 'healthconnect',
    externalId: s.id,
    externalUrl: '',
    externalRaw: JSON.stringify(s),
    calories,
  }
}

export function pushedToDraft(p: {
  externalId: string
  date: string
  exercise: string
  notes: string | null
  raw: string
  calories?: number | null
}): DraftTrainingEntry {
  const calories =
    p.calories != null && p.calories > 0
      ? Math.round(p.calories)
      : null
  return {
    date: p.date,
    exercise: p.exercise,
    sets: 1,
    reps: 1,
    weightKg: 0,
    rpe: null,
    notes: p.notes ?? '',
    volume: 0,
    source: 'healthconnect',
    externalId: p.externalId,
    externalUrl: '',
    externalRaw: p.raw,
    calories,
  }
}
