/** Common draft shape produced by every integration's mapping module. */
export interface DraftTrainingEntry {
  date: string         // yyyy-mm-dd local
  exercise: string
  sets: number
  reps: number
  weightKg: number
  rpe: number | null
  notes: string
  volume: number
  source: string       // 'strava' | 'garmin' | 'healthkit' | 'healthconnect'
  externalId: string
  externalUrl: string
  externalRaw: string
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function fmtDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`
  return `${Math.round(m)} m`
}
