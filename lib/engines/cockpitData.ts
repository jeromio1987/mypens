/**
 * Build a cockpit payload for a selected date window.
 * Used by GET /api/period-review?from=&to=
 */

import { prisma } from '@/lib/db'
import { buildDailySignals, scoreDay, analyzePeriods } from '../../scripts/lib/periodAnalyze.mjs'
import { analyzeCausal, classifyRhrDrinkBand } from '../../scripts/lib/periodCausal.mjs'
import { loadGarminData } from '../../scripts/lib/garminAnalyze.mjs'
import { loadConfounders } from '../../scripts/lib/periodCausal.mjs'

export type CockpitDay = {
  date: string
  formScore: number | null
  sleepHours: number | null
  stress: number | null
  hrv: number | null
  restingHr: number | null
  rhrBand: string | null
  steps: number | null
  activityMinutes: number
  activityCount: number
}

function clip<T extends { date: string }>(rows: T[], from: string, to: string) {
  return rows.filter(r => r.date >= from && r.date <= to)
}

export async function buildCockpitWindow(opts: { from: string; to: string; asOf?: string }) {
  const { from, to } = opts
  const asOf = opts.asOf || to

  const [garmin, confounders] = await Promise.all([
    loadGarminData(prisma, { allTime: true }),
    loadConfounders(prisma, {}),
  ])

  const data = {
    sleeps: clip(garmin.sleeps || [], from, to),
    metrics: clip(garmin.metrics || [], from, to),
    activities: clip(garmin.activities || [], from, to),
    trainings: clip(garmin.trainings || [], from, to),
    weights: clip(garmin.weights || [], from, to),
    recoveries: clip(confounders.recoveries || [], from, to),
    dayEntries: clip(confounders.dayEntries || [], from, to),
  }

  const daily = buildDailySignals(data)
  const series: CockpitDay[] = daily.map((d: Record<string, unknown>) => ({
    date: d.date as string,
    formScore: scoreDay(d),
    sleepHours: (d.sleepHours as number | null) ?? null,
    stress: (d.stress as number | null) ?? null,
    hrv: (d.hrv as number | null) ?? null,
    restingHr: (d.restingHr as number | null) ?? null,
    rhrBand: classifyRhrDrinkBand(d.restingHr as number | null),
    steps: (d.steps as number | null) ?? null,
    activityMinutes: (d.activityMinutes as number) || 0,
    activityCount: (d.activityCount as number) || 0,
  }))

  const formScores = series.map(s => s.formScore).filter((n): n is number => n != null)
  const avgForm =
    formScores.length === 0
      ? null
      : Math.round((formScores.reduce((a, b) => a + b, 0) / formScores.length) * 10) / 10

  const fullData = {
    sleeps: garmin.sleeps || [],
    metrics: garmin.metrics || [],
    activities: garmin.activities || [],
    trainings: garmin.trainings || [],
    weights: [...(garmin.weights || []), ...(confounders.weights || [])],
    recoveries: confounders.recoveries || [],
    dayEntries: confounders.dayEntries || [],
  }

  // Horizons relative to `to` so zoom end drives the read
  const periods = analyzePeriods(fullData, {
    asOf,
    horizonsMonths: [1, 3, 6, 12],
  })

  const causal = analyzeCausal(daily, {
    recoveries: data.recoveries,
    dayEntries: data.dayEntries,
    weights: data.weights,
  })

  const theRead = {
    verdict:
      avgForm == null ? null : avgForm >= 65 ? 'good' : avgForm >= 45 ? 'mixed' : 'bad',
    avgForm,
    leadingCause: causal.topHypothesis
      ? {
          id: causal.topHypothesis.id,
          label: causal.topHypothesis.label,
          confidence: causal.topHypothesis.confidence,
        }
      : null,
    topRisk: periods.topPatterns?.find((p: { severity: string }) => p.severity === 'high')?.title || null,
    topWin:
      series.filter(s => (s.activityCount || 0) > 0).length >= 3
        ? `${series.filter(s => (s.activityCount || 0) > 0).length} active days in window`
        : null,
    nextAction: causal.topHypothesis?.id?.startsWith('rhr_') ||
    causal.topHypothesis?.id?.includes('alcohol')
      ? 'Protect clean mornings (RHR ≤49) and log Anchor drinks the same night.'
      : avgForm != null && avgForm < 45
        ? 'Prioritise sleep floor 7h+ before adding intensity.'
        : 'Keep the weekend long session; keep mid-week easy if Form dips.',
    headline: periods.headline,
  }

  return {
    from,
    to,
    asOf,
    theRead,
    series,
    thresholds: { rhrLikely: 50, rhrHeavy: 55 },
    causal: {
      topHypothesis: causal.topHypothesis,
      narrative: causal.narrative,
      alcohol: causal.alcohol,
      rhrLadder: causal.rhrLadder,
      hypotheses: causal.hypotheses?.slice(0, 5),
    },
    periods: {
      headline: periods.headline,
      deepAnalysis: periods.deepAnalysis,
      topHypothesis: periods.topHypothesis,
      horizons: periods.horizons,
      dataSpan: periods.dataSpan,
    },
    inventory: {
      nights: data.sleeps.length,
      activities: data.activities.length,
      trainings: data.trainings.length,
      weights: data.weights.length,
      days: series.length,
    },
  }
}
