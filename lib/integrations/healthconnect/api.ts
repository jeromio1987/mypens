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

export async function listPendingWorkouts() {
  return prisma.pushedWorkout.findMany({
    where: { source: 'healthconnect' },
    orderBy: { date: 'desc' },
    take: 200,
  })
}
