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
  trainingLoad: number
  hardLoad: number
  easyLoad: number
}

function clip<T extends { date: string }>(rows: T[], from: string, to: string) {
  return rows.filter(r => r.date >= from && r.date <= to)
}

function spanOf(rows: { date: string }[]) {
  if (!rows.length) return { count: 0, from: null as string | null, to: null as string | null }
  const dates = rows.map(r => r.date).filter(Boolean).sort()
  return { count: rows.length, from: dates[0], to: dates[dates.length - 1] }
}

export async function buildCockpitWindow(opts: { from: string; to: string; asOf?: string }) {
  const { from, to } = opts
  const asOf = opts.asOf || to

  const loadNotes: string[] = []
  let garmin: Awaited<ReturnType<typeof loadGarminData>>
  let confounders: Awaited<ReturnType<typeof loadConfounders>>
  try {
    ;[garmin, confounders] = await Promise.all([
      loadGarminData(prisma, { allTime: true }),
      loadConfounders(prisma, {}),
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    loadNotes.push(`Ledger load failed: ${msg}`)
    garmin = {
      sleeps: [],
      weights: [],
      trainings: [],
      activities: [],
      metrics: [],
      weekOf: undefined,
      weekEnd: undefined,
    }
    confounders = { recoveries: [], dayEntries: [], weights: [] }
  }

  const allSleeps = garmin.sleeps || []
  const allActivities = garmin.activities || []
  const allTrainings = garmin.trainings || []
  const allWeights = garmin.weights || []
  const allMetrics = garmin.metrics || []

  const ledger = {
    sleep: spanOf(allSleeps),
    activities: spanOf(allActivities),
    trainings: spanOf(allTrainings),
    weights: spanOf(allWeights),
    metrics: spanOf(allMetrics),
    totalRows:
      allSleeps.length +
      allActivities.length +
      allTrainings.length +
      allWeights.length +
      allMetrics.length,
  }

  // Suggested full span across all sources
  const allDates = [
    ledger.sleep.from,
    ledger.sleep.to,
    ledger.activities.from,
    ledger.activities.to,
    ledger.trainings.from,
    ledger.trainings.to,
    ledger.weights.from,
    ledger.weights.to,
    ledger.metrics.from,
    ledger.metrics.to,
  ].filter(Boolean) as string[]
  allDates.sort()
  const suggestedSpan =
    allDates.length > 0 ? { from: allDates[0], to: allDates[allDates.length - 1] } : null

  // Cross-check with raw counts (not wrapped in loadGarminData's silent safe()).
  let rawCounts: Record<string, number> | null = null
  try {
    const [sleepN, actN, trainN, weightN, metricN] = await Promise.all([
      prisma.sleepEntry.count(),
      prisma.garminActivity.count(),
      prisma.trainingEntry.count(),
      prisma.weightEntry.count(),
      prisma.garminDailyMetric ? prisma.garminDailyMetric.count() : Promise.resolve(0),
    ])
    rawCounts = {
      sleep: sleepN,
      activities: actN,
      trainings: trainN,
      weights: weightN,
      metrics: metricN,
    }
    const rawTotal = sleepN + actN + trainN + weightN + metricN
    if (ledger.totalRows === 0 && rawTotal > 0) {
      loadNotes.push(
        `Prisma tables have ${rawTotal} rows, but the cockpit loader returned 0 (likely a query/select mismatch). Check the Next.js terminal for [garmin-analyze] warnings.`,
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/must start with the protocol|DATABASE_URL|datasource `db`/i.test(msg)) {
      loadNotes.push(
        'DATABASE_URL is missing or invalid in this app’s .env (must start with postgresql:// or postgres://). Fix .env, then fully restart npm run dev — Supabase SQL working does not mean local Next can connect.',
      )
    } else {
      loadNotes.push(`Could not count ledger tables: ${msg}`)
    }
  }

  if (
    ledger.totalRows === 0 &&
    rawCounts &&
    Object.values(rawCounts).every(n => n === 0) &&
    !loadNotes.some(n => /DATABASE_URL is missing/i.test(n))
  ) {
    loadNotes.push(
      'Supabase ledger is empty for SleepEntry / GarminActivity / TrainingEntry / WeightEntry / GarminDailyMetric. Re-run the Garmin dump import against this same DATABASE_URL.',
    )
  } else if (ledger.totalRows === 0 && rawCounts == null) {
    // Count failed (e.g. bad URL) — do not claim the ledger is empty.
  }

  const metricKindCounts: Record<string, number> = {}
  for (const m of allMetrics) {
    const k = String(m.kind || 'unknown')
    metricKindCounts[k] = (metricKindCounts[k] || 0) + 1
  }

  const data = {
    sleeps: clip(allSleeps, from, to),
    metrics: clip(allMetrics, from, to),
    activities: clip(allActivities, from, to),
    trainings: clip(allTrainings, from, to),
    weights: clip(allWeights, from, to),
    recoveries: clip(confounders.recoveries || [], from, to),
    dayEntries: clip(confounders.dayEntries || [], from, to),
  }

  if (
    ledger.totalRows > 0 &&
    data.sleeps.length + data.activities.length + data.trainings.length + data.metrics.length === 0
  ) {
    loadNotes.push(
      `Window ${from}→${to} has 0 rows, but the ledger has data` +
        (suggestedSpan ? ` from ${suggestedSpan.from} to ${suggestedSpan.to}` : '') +
        '. Widen the zoom (Use full ledger span).',
    )
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
    trainingLoad: (d.trainingLoad as number) || 0,
    hardLoad: (d.hardLoad as number) || 0,
    easyLoad: (d.easyLoad as number) || 0,
  }))

  const hrvDays = series.filter(s => s.hrv != null).length
  const stressDays = series.filter(s => s.stress != null).length
  if (data.metrics.length > 0 || data.sleeps.length > 0) {
    if (hrvDays === 0) {
      loadNotes.push(
        'HRV series is empty in this window (no GarminDailyMetric kind=hrv and no SleepEntry.hrv). Re-run the Garmin dump import after pulling the nested-HRV importer fix.',
      )
    }
    if (stressDays === 0) {
      loadNotes.push(
        'Stress series is empty in this window (no GarminDailyMetric kind=stress). Steps can exist without stress — re-import wellness/UDS files.',
      )
    }
  }

  const formScores = series.map(s => s.formScore).filter((n): n is number => n != null)
  const avgForm =
    formScores.length === 0
      ? null
      : Math.round((formScores.reduce((a, b) => a + b, 0) / formScores.length) * 10) / 10

  const fullData = {
    sleeps: allSleeps,
    metrics: allMetrics,
    activities: allActivities,
    trainings: allTrainings,
    weights: [...allWeights, ...(confounders.weights || [])],
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
    ledger,
    rawCounts,
    suggestedSpan,
    loadNotes,
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
      hrvDays,
      stressDays,
      metricKinds: metricKindCounts,
    },
  }
}
