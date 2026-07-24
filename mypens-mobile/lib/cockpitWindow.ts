/** Date helpers for live cockpit windows on mobile. */

export function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isoDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type CockpitWindowDays = 7 | 30 | 90

export function cockpitRange(days: CockpitWindowDays): { from: string; to: string } {
  const to = isoToday()
  return { from: isoDaysAgo(days - 1), to }
}

export type TheReadPayload = {
  verdict: 'good' | 'mixed' | 'bad' | null
  avgForm: number | null
  leadingCause: { id: string; label: string; confidence: number } | null
  topRisk: string | null
  topWin: string | null
  nextAction: string
  headline: string
}

export type CockpitSeriesDay = {
  date: string
  formScore: number | null
  trainingLoad: number
  easyLoad: number
  hardLoad: number
  activityMinutes: number
  activityCount: number
  restingHr: number | null
  sleepHours: number | null
}

export type CockpitLive = {
  from: string
  to: string
  theRead: TheReadPayload
  series: CockpitSeriesDay[]
  inventory?: {
    nights?: number
    activities?: number
    trainings?: number
    days?: number
  }
  causal?: {
    narrative?: string
    rhrLadder?: { likelyDrinkingDays?: number; heavyStackDays?: number }
  }
  suggestedSpan?: { from: string; to: string } | null
  loadNotes?: string[]
}

export type PeriodReviewLiveResponse = {
  mode: 'live'
  cockpit: CockpitLive
}

export function summarizeTraining(series: CockpitSeriesDay[]) {
  const active = series.filter(d => (d.activityCount || 0) > 0 || (d.trainingLoad || 0) > 0)
  const totalPlu = series.reduce((a, d) => a + (d.trainingLoad || 0), 0)
  const hardPlu = series.reduce((a, d) => a + (d.hardLoad || 0), 0)
  const easyPlu = series.reduce((a, d) => a + (d.easyLoad || 0), 0)
  const minutes = series.reduce((a, d) => a + (d.activityMinutes || 0), 0)
  const peak = series.reduce((m, d) => Math.max(m, d.trainingLoad || 0), 0)
  return {
    activeDays: active.length,
    totalPlu: Math.round(totalPlu),
    hardPlu: Math.round(hardPlu),
    easyPlu: Math.round(easyPlu),
    minutes: Math.round(minutes),
    peak: Math.round(peak),
  }
}

export function verdictColor(verdict: TheReadPayload['verdict']): string {
  if (verdict === 'good') return '#34d399'
  if (verdict === 'mixed') return '#fbbf24'
  if (verdict === 'bad') return '#f87171'
  return '#94a3b8'
}
