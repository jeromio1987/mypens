/** Date helpers for live cockpit windows on mobile — reads P9 timeWindow. */

import { pensFetch } from './pensApi'
import { rollingWindow, shiftDateStr, today } from './timeWindow'

/** Shared React Query key — EngineReadCard, period-review, TrainingReviewCard, Train load bars. */
export function cockpitQueryKey(from: string, to: string) {
  return ['cockpit', from, to] as const
}

/** Train week bars need ~8 Mon–Sun weeks (~55d); TrainingReviewCard fetches this once. */
export const TRAIN_COCKPIT_DAYS = 55

export async function fetchCockpitLive(
  from: string,
  to: string,
): Promise<PeriodReviewLiveResponse> {
  const res = await pensFetch(
    `/api/period-review?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  )
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? `Period review ${res.status}`)
  }
  return (await res.json()) as PeriodReviewLiveResponse
}

export function isoToday(): string {
  return today()
}

export function isoDaysAgo(days: number, from: Date = new Date()): string {
  return shiftDateStr(today(from), -days)
}

export type CockpitWindowDays = 7 | 30 | 90

/** Rolling inclusive window (label: rolling). Same bounds as web verdict/dashboard. */
export function cockpitRange(days: CockpitWindowDays): {
  from: string
  to: string
  label: 'rolling'
  days: number
} {
  const w = rollingWindow(days)
  return { from: w.from, to: w.to, label: 'rolling', days: w.days }
}

export type TheReadPayload = {
  verdict: 'good' | 'mixed' | 'bad' | null
  avgForm: number | null
  /** Mean Form signal count among days that cleared the min-input gate. */
  avgFormInputs?: number | null
  formSignalCount?: number
  leadingCause: { id: string; label: string; confidence: number } | null
  topRisk: string | null
  topWin: string | null
  nextAction: string
  headline: string
}

export type CockpitSeriesDay = {
  date: string
  formScore: number | null
  formInputs?: number
  trainingLoad: number
  easyLoad: number
  hardLoad: number
  activityMinutes: number
  activityCount: number
  restingHr: number | null
  sleepHours: number | null
  /** Banister CTL — Fitness (optional; server-enriched). */
  ctl?: number | null
  /** Banister ATL — Fatigue. */
  atl?: number | null
  /** TSB = CTL − ATL — load Form (not cockpit formScore). */
  tsb?: number | null
  /** Acute:Chronic EWMA₇/EWMA₂₈. */
  acwr?: number | null
}

export type FitnessFreshnessSnapshot = {
  date: string
  ctl: number
  atl: number | null
  tsb: number | null
  acwr: number | null
  note?: string
}

export type FosterWeekSnapshot = {
  from: string
  to: string
  weeklyLoad: number
  monotony: number | null
  strain: number | null
}

export type CockpitLive = {
  from: string
  to: string
  theRead: TheReadPayload
  series: CockpitSeriesDay[]
  fitnessFreshness?: FitnessFreshnessSnapshot | null
  fosterWeek?: FosterWeekSnapshot | null
  inventory?: {
    nights?: number
    activities?: number
    trainings?: number
    days?: number
  }
  causal?: {
    narrative?: string
    rhrLadder?: {
      likelyDrinkingDays?: number
      heavyStackDays?: number
      latestRhr?: number | null
      latestBand?: string | null
    }
  }
  suggestedSpan?: { from: string; to: string } | null
  loadNotes?: string[]
}

export type PeriodReviewLiveResponse = {
  mode: 'live'
  cockpit: CockpitLive
}

/** Prefer top-level fitnessFreshness; fall back to last series day with ctl. */
export function pickFitnessFreshness(
  cockpit: CockpitLive | null | undefined,
): FitnessFreshnessSnapshot | null {
  if (cockpit?.fitnessFreshness?.ctl != null) return cockpit.fitnessFreshness
  const series = cockpit?.series ?? []
  for (let i = series.length - 1; i >= 0; i--) {
    const d = series[i]
    if (d.ctl != null) {
      return {
        date: d.date,
        ctl: d.ctl,
        atl: d.atl ?? null,
        tsb: d.tsb ?? null,
        acwr: d.acwr ?? null,
      }
    }
  }
  return null
}

export function formatLoadNum(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n))
}

/** TSB < 0 → fatigued; ACWR ≥ 1.5 → elevated acute load (descriptive only). */
export function fitnessFlags(ff: FitnessFreshnessSnapshot | null): {
  fatigued: boolean
  elevatedAcwr: boolean
} {
  if (!ff) return { fatigued: false, elevatedAcwr: false }
  return {
    fatigued: ff.tsb != null && ff.tsb < 0,
    elevatedAcwr: ff.acwr != null && ff.acwr >= 1.5,
  }
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
