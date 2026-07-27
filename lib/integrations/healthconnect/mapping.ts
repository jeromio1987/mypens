import { fmtDistance, fmtDuration, type DraftTrainingEntry } from '../_shared/draft'
import type { HealthConnectExerciseSession } from './api'

const STRENGTH_TYPES = new Set([
  'STRENGTH_TRAINING',
  'WEIGHTLIFTING',
  'CALISTHENICS',
  'CROSSFIT',
  'HIGH_INTENSITY_INTERVAL_TRAINING',
])

/** Common Health Connect ExerciseType ints → enum-style keys. */
export const TYPE_ALIASES: Record<string, string> = {
  TYPE_8: 'BIKING',
  TYPE_9: 'BIKING_STATIONARY',
  TYPE_13: 'CALISTHENICS',
  TYPE_37: 'HIKING',
  TYPE_56: 'RUNNING',
  TYPE_57: 'RUNNING_TREADMILL',
  TYPE_58: 'SAILING',
  TYPE_67: 'SKIING',
  TYPE_70: 'STRENGTH_TRAINING',
  TYPE_73: 'SWIMMING_OPEN_WATER',
  TYPE_74: 'SWIMMING_POOL',
  TYPE_75: 'TENNIS',
  TYPE_79: 'WALKING',
  TYPE_81: 'WEIGHTLIFTING',
  TYPE_82: 'WHEELCHAIR',
  TYPE_83: 'OTHER_WORKOUT',
}

/**
 * Normalize raw HC exercise type strings:
 * "79", "Type 79", "TYPE_79", "type_79" → TYPE_79 key, then alias / title-case.
 */
export function normalizeExerciseTypeKey(type: string): string {
  const raw = String(type ?? '').trim()
  if (!raw) return 'OTHER_WORKOUT'
  const bare = raw.match(/^(?:type[_\s-]*)?(\d+)$/i)
  if (bare) return `TYPE_${bare[1]}`
  return raw.toUpperCase().replace(/\s+/g, '_')
}

export function humanType(type: string): string {
  const key = normalizeExerciseTypeKey(type)
  const label = TYPE_ALIASES[key] ?? key
  return label
    .toLowerCase()
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

/** True when a stored exercise label is a raw HC type stub worth rewriting. */
export function isRawTypeLabel(label: string | null | undefined): boolean {
  if (!label) return false
  return /^(?:type[_\s-]*)?\d+$/i.test(label.trim()) || /^TYPE_\d+$/i.test(label.trim())
}

function isoDate(iso: string): string {
  // Calendar day in Europe/Brussels (not UTC slice — late rides must not roll to previous day).
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export function mapSessionToDraft(s: HealthConnectExerciseSession): DraftTrainingEntry {
  const typeKey = normalizeExerciseTypeKey(s.exerciseType)
  const isStrength = STRENGTH_TYPES.has(TYPE_ALIASES[typeKey] ?? typeKey)
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
