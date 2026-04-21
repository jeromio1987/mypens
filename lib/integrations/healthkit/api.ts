import { prisma } from '@/lib/db'

/**
 * Shape that the iOS companion app POSTs into `/ingest`. Mirrors HealthKit's
 * `HKWorkout` summary fields.
 */
export interface HealthkitWorkout {
  uuid: string
  workoutActivityType: string         // e.g. 'traditionalStrengthTraining', 'running'
  startDate: string                   // ISO timestamp (local or UTC w/ offset)
  endDate?: string
  durationSec: number
  totalDistanceM?: number
  totalEnergyKcal?: number
  averageHeartRate?: number
  sourceName?: string                 // e.g. "Apple Watch"
  notes?: string
}

export async function listPendingWorkouts() {
  return prisma.pushedWorkout.findMany({
    where: { source: 'healthkit' },
    orderBy: { date: 'desc' },
    take: 200,
  })
}
