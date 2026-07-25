import { prisma } from '@/lib/db'

/**
 * Shape that the Android companion POSTs to `/ingest`. Mirrors Health
 * Connect's `ExerciseSessionRecord`.
 */
export interface HealthConnectExerciseSession {
  id: string
  exerciseType: string                // e.g. 'STRENGTH_TRAINING', 'RUNNING'
  title?: string
  startTime: string                   // ISO timestamp
  endTime?: string
  durationSec: number
  totalDistanceM?: number
  totalEnergyKcal?: number
  averageHeartRate?: number
  packageName?: string                // source app
  notes?: string
}

/**
 * Shape that the Android companion POSTs to `/sleep-ingest`.
 * Mirrors Health Connect `SleepSessionRecord` (+ optional averaged HRV).
 * Prefer client-computed date/bedtime/wakeTime (device local TZ); ISO times are fallback.
 */
export interface HealthConnectSleepSession {
  id: string
  startTime: string                   // ISO — bedtime
  endTime: string                     // ISO — wake
  /** Wake calendar date YYYY-MM-DD in device local TZ (preferred). */
  date?: string
  /** HH:MM local (preferred). */
  bedtime?: string
  wakeTime?: string
  hours?: number
  /** Optional RMSSD HRV in ms averaged over the sleep window (if HC has it). */
  hrvMs?: number
  packageName?: string
  title?: string
  notes?: string
}

export async function listPendingWorkouts() {
  return prisma.pushedWorkout.findMany({
    where: { source: 'healthconnect' },
    orderBy: { date: 'desc' },
    take: 200,
  })
}
