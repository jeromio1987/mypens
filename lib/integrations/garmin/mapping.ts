import type { GarminActivity } from './api'
import { fmtDistance, fmtDuration, type DraftTrainingEntry } from '../_shared/draft'
import { toDateStr } from '@/lib/timeWindow'

const STRENGTH_TYPES = new Set([
  'STRENGTH_TRAINING',
  'INDOOR_STRENGTH_TRAINING',
  'CROSSFIT',
  'CARDIO',
])

function localDate(startSec: number, offsetSec = 0): string {
  const d = new Date((startSec + offsetSec) * 1000)
  return toDateStr(d)
}

function humanType(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

export function mapActivityToDraft(a: GarminActivity): DraftTrainingEntry {
  const isStrength = STRENGTH_TYPES.has(a.activityType)
  const niceType = humanType(a.activityType)
  const exercise = isStrength
    ? (a.activityName?.trim() || 'Strength training')
    : `${niceType}${a.activityName && a.activityName !== niceType ? ` — ${a.activityName}` : ''}`

  const noteParts: string[] = []
  if (isStrength) noteParts.push('Strength')
  if (a.durationInSeconds) noteParts.push(fmtDuration(a.durationInSeconds))
  if (a.distanceInMeters && a.distanceInMeters > 0) noteParts.push(fmtDistance(a.distanceInMeters))
  if (a.totalElevationGainInMeters && a.totalElevationGainInMeters > 0) {
    noteParts.push(`↑ ${Math.round(a.totalElevationGainInMeters)} m`)
  }
  if (a.averageHeartRateInBeatsPerMinute) {
    noteParts.push(`avg HR ${Math.round(a.averageHeartRateInBeatsPerMinute)}`)
  }
  if (a.activeKilocalories) noteParts.push(`${Math.round(a.activeKilocalories)} kcal`)

  const calories =
    a.activeKilocalories != null && a.activeKilocalories > 0
      ? Math.round(a.activeKilocalories)
      : null

  return {
    date: localDate(a.startTimeInSeconds, a.startTimeOffsetInSeconds ?? 0),
    exercise,
    sets: 1,
    reps: 1,
    weightKg: 0,
    rpe: null,
    notes: noteParts.join(' · '),
    volume: 0,
    source: 'garmin',
    externalId: String(a.activityId),
    externalUrl: `https://connect.garmin.com/modern/activity/${a.activityId}`,
    externalRaw: JSON.stringify(a),
    calories,
  }
}
