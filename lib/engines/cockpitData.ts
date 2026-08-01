/**
 * Build a cockpit payload for a selected date window.
 * Used by GET /api/period-review?from=&to=
 */

import { prisma } from '@/lib/db'
import {
  buildDailySignals,
  scoreDay,
  analyzePeriods,
  FORM_MIN_INPUTS,
  FORM_SIGNAL_COUNT,
} from '../../scripts/lib/periodAnalyze.mjs'
import { analyzeCausal, classifyRhrDrinkBand } from '../../scripts/lib/periodCausal.mjs'
import { loadGarminData } from '../../scripts/lib/garminAnalyze.mjs'
import { loadConfounders } from '../../scripts/lib/periodCausal.mjs'
import { getEnergyBalanceForRange, type WindowDayEnergy } from '@/lib/energyBalance'
import { loadBloodworkLatestSummary } from '@/lib/bloodworkLatestSummary'
import {
  addDaysIso,
  buildFitnessSeries,
  fosterWeekEnding,
  type FosterWeek,
} from '@/lib/engines/trainingMetrics'

export type CockpitDay = {
  date: string
  formScore: number | null
  /** How many of FORM_SIGNAL_COUNT inputs contributed to formScore (0 when none). */
  formInputs: number
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
  /** Banister CTL — Fitness (42d EWMA of PLU). */
  ctl: number | null
  /** Banister ATL — Fatigue (7d EWMA of PLU). */
  atl: number | null
  /** TSB = CTL − ATL — Form / Freshness (not cockpit formScore). */
  tsb: number | null
  /** Acute:Chronic = EWMA₇ / EWMA₂₈. */
  acwr: number | null
  /** WP 2.1 — nutrition from FoodEntry (window-scoped). */
  kcalIn: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  foodLogged: boolean
  energyDelta: number | null
  /** NEAT path for the day — `steps_model` down-ranks deficit narratives (E2). */
  neatSource: string | null
  foodIncomplete: boolean
}

function clip<T extends { date: string }>(rows: T[], from: string, to: string) {
  return rows.filter(r => r.date >= from && r.date <= to)
}

function spanOf(rows: { date: string }[]) {
  if (!rows.length) return { count: 0, from: null as string | null, to: null as string | null }
  const dates = rows.map(r => r.date).filter(Boolean).sort()
  return { count: rows.length, from: dates[0], to: dates[dates.length - 1] }
}

type RiskPattern = { id?: string; severity: string; title: string }

/**
 * First high-severity pattern that is not the same finding as leadingCause.
 * Causal patterns are prepended into topPatterns with title `${label} (N%)`,
 * so a naive `.find(severity===high)` reprints Cause as Risk.
 */
export function pickDistinctTopRisk(
  patterns: RiskPattern[] | null | undefined,
  leadingCause: { id: string; label: string } | null,
): string | null {
  if (!patterns?.length) return null
  const causeId = leadingCause?.id ?? null
  const causeLabel = leadingCause?.label?.trim().toLowerCase() ?? null

  const sameAsCause = (p: RiskPattern) => {
    if (causeId && p.id && p.id === causeId) return true
    if (!causeLabel) return false
    const bare = p.title.replace(/\s*\(\d+%\)\s*$/, '').trim().toLowerCase()
    return bare === causeLabel
  }

  return patterns.find(p => p.severity === 'high' && !sameAsCause(p))?.title ?? null
}

/**
 * Period-analyze headlines describe Form-week stretches / multi-month views —
 * not the rolling chip window. Prefix so The Read does not look like the chip range.
 */
export function formatTheReadHeadline(raw: string | null | undefined): string {
  const h = (raw || '').trim()
  if (!h) return 'No read yet for this window.'
  // Always label — headlines describe Form-week stretches, not the chip window (R1).
  if (/^Form weeks\s*·/i.test(h)) return h
  return `Form weeks · ${h}`
}

export async function buildCockpitWindow(opts: {
  from: string
  to: string
  asOf?: string
  /** When true, run five prisma.count() ledger cross-checks (debug only). */
  debug?: boolean
}) {
  const { from, to } = opts
  const asOf = opts.asOf || to
  const debug = Boolean(opts.debug)

  // Live path: clip ledger load to window + 90d lookback (CTL warm-start / fitness).
  // Do NOT use allTime — that wedges the API on large ledgers.
  // Bloodwork uses loadBloodworkLatestSummary separately (not this clip).
  const loadFrom = addDaysIso(from, -90)

  const loadNotes: string[] = []
  let garmin: Awaited<ReturnType<typeof loadGarminData>>
  let confounders: Awaited<ReturnType<typeof loadConfounders>>
  try {
    ;[garmin, confounders] = await Promise.all([
      loadGarminData(prisma, { weekOf: loadFrom, weekEnd: to, allTime: false }),
      loadConfounders(prisma, { from: loadFrom, to }),
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

  // Cross-check with raw counts — gated behind ?debug=1 (five COUNT(*) scans).
  let rawCounts: {
    sleep: number
    activities: number
    trainings: number
    weights: number
    metrics: number
  } | null = null
  if (debug) {
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

  // WP 2.1 — window-scoped energy/macros via the shared engine
  // (lib/energyBalance.ts getEnergyBalanceForRange), batched for [from, to]
  // only (not allTime). Fed into buildDailySignals as data.food so the
  // periodAnalyze/periodCausal nutrition hypothesis (foodEnergyWindowStats)
  // sees real kcalIn/energyDelta instead of staying dark.
  //
  // Run energy + incomplete tags + hrMax + labs in one wave after the ledger
  // load — sequential awaits here used to add multi-second eu-west-1 RTT.
  const foodByDate = new Map<
    string,
    {
      kcalIn: number
      proteinG: number
      carbsG: number
      fatG: number
      foodLogged: boolean
      energyDelta: number | null
      neatSource: string | null
    }
  >()
  const incompleteByDate = new Map<string, boolean>()

  const [energyResult, incompleteRows, hrMax, labsSummary] = await Promise.all([
    getEnergyBalanceForRange(from, to)
      .then(rows => ({ ok: true as const, rows }))
      .catch((err: unknown) => ({
        ok: false as const,
        rows: [] as WindowDayEnergy[],
        err,
      })),
    prisma.dayEntry
      .findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, tags: true },
      })
      .catch(() => [] as { date: string; tags: string | null }[]),
    prisma.userSettings
      .findUnique({ where: { id: 'default' }, select: { hrMax: true } })
      .then(s => (s?.hrMax != null && s.hrMax > 0 ? s.hrMax : null))
      .catch(() => null as number | null),
    loadBloodworkLatestSummary().catch(() => null),
  ])

  if (!energyResult.ok) {
    const msg = energyResult.err instanceof Error ? energyResult.err.message : String(energyResult.err)
    loadNotes.push(`Food/energy window load failed: ${msg}`)
  } else {
    for (const row of energyResult.rows) {
      foodByDate.set(row.date, {
        kcalIn: row.kcalIn,
        proteinG: row.proteinG,
        carbsG: row.carbsG,
        fatG: row.fatG,
        foodLogged: row.foodCoverage,
        energyDelta: row.delta,
        neatSource: row.neatSource ?? null,
      })
    }
  }
  for (const d of incompleteRows) {
    try {
      const tags = JSON.parse(String(d.tags || '[]')) as unknown
      if (Array.isArray(tags) && tags.includes('food_incomplete')) {
        incompleteByDate.set(d.date, true)
      }
    } catch {
      /* ignore */
    }
  }

  const foodForSignals = [...foodByDate.entries()]
    .filter(([, food]) => food.foodLogged)
    .map(([date, food]) => ({
      date,
      kcal: food.kcalIn,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      energyDelta: food.energyDelta ?? undefined,
      neatSource: food.neatSource ?? undefined,
    }))

  const daily = buildDailySignals({
    ...data,
    food: foodForSignals,
    ...(hrMax != null ? { hrMax } : {}),
  })

  // Fitness/Freshness needs ~CTL τ lookback so window-start CTL isn't cold-started.
  const fitnessFrom = addDaysIso(from, -90)
  const lookbackDaily = buildDailySignals({
    sleeps: clip(allSleeps, fitnessFrom, to),
    metrics: clip(allMetrics, fitnessFrom, to),
    activities: clip(allActivities, fitnessFrom, to),
    trainings: clip(allTrainings, fitnessFrom, to),
    weights: clip(allWeights, fitnessFrom, to),
    recoveries: clip(confounders.recoveries || [], fitnessFrom, to),
    dayEntries: clip(confounders.dayEntries || [], fitnessFrom, to),
    ...(hrMax != null ? { hrMax } : {}),
  })
  const fitnessSeries = buildFitnessSeries(
    lookbackDaily.map((d: { date: string; trainingLoad?: number }) => ({
      date: d.date,
      load: Number(d.trainingLoad) || 0,
    })),
    { from: fitnessFrom, to },
  )
  const fitnessByDate = new Map(fitnessSeries.map(f => [f.date, f]))
  const fosterWeek: FosterWeek = fosterWeekEnding(
    fitnessSeries.map(f => ({ date: f.date, load: f.load })),
    to,
    7,
  )

  const series: CockpitDay[] = daily.map((d: Record<string, unknown>) => {
    const date = d.date as string
    const food = foodByDate.get(date)
    const fit = fitnessByDate.get(date)
    const scored = scoreDay(d) as { score: number; formInputs: number } | null
    const formInputs = scored?.formInputs ?? 0
    const formScore =
      scored != null && formInputs >= FORM_MIN_INPUTS ? scored.score : null
    return {
      date,
      formScore,
      formInputs,
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
      ctl: fit?.ctl ?? null,
      atl: fit?.atl ?? null,
      tsb: fit?.tsb ?? null,
      acwr: fit?.acwr ?? null,
      kcalIn: food?.foodLogged ? Math.round(food.kcalIn) : null,
      proteinG: food?.foodLogged ? Math.round(food.proteinG) : null,
      carbsG: food?.foodLogged ? Math.round(food.carbsG) : null,
      fatG: food?.foodLogged ? Math.round(food.fatG) : null,
      foodLogged: Boolean(food?.foodLogged),
      energyDelta: food?.energyDelta ?? null,
      neatSource: food?.neatSource ?? null,
      foodIncomplete: incompleteByDate.get(date) ?? false,
    }
  })

  for (const [date, food] of foodByDate) {
    if (series.some(s => s.date === date)) continue
    if (!food.foodLogged) continue
    const fit = fitnessByDate.get(date)
    series.push({
      date,
      formScore: null,
      formInputs: 0,
      sleepHours: null,
      stress: null,
      hrv: null,
      restingHr: null,
      rhrBand: null,
      steps: null,
      activityMinutes: 0,
      activityCount: 0,
      trainingLoad: 0,
      hardLoad: 0,
      easyLoad: 0,
      ctl: fit?.ctl ?? null,
      atl: fit?.atl ?? null,
      tsb: fit?.tsb ?? null,
      acwr: fit?.acwr ?? null,
      kcalIn: Math.round(food.kcalIn),
      proteinG: Math.round(food.proteinG),
      carbsG: Math.round(food.carbsG),
      fatG: Math.round(food.fatG),
      foodLogged: true,
      energyDelta: food.energyDelta,
      neatSource: food.neatSource ?? null,
      foodIncomplete: incompleteByDate.get(date) ?? false,
    })
  }
  series.sort((a, b) => a.date.localeCompare(b.date))

  const foodLoggedDays = series.filter(s => s.foodLogged).length
  if (foodLoggedDays === 0 && !loadNotes.some(n => /Food\/energy window/i.test(n))) {
    loadNotes.push('No FoodEntry rows in this window — nutrition causes stay quiet.')
  }

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

  const formReady = series.filter(
    s => s.formScore != null && s.formInputs >= FORM_MIN_INPUTS,
  )
  const avgForm =
    formReady.length === 0
      ? null
      : Math.round(
          (formReady.reduce((a, s) => a + (s.formScore as number), 0) / formReady.length) * 10,
        ) / 10
  const avgFormInputs =
    formReady.length === 0
      ? null
      : Math.round(
          (formReady.reduce((a, s) => a + s.formInputs, 0) / formReady.length) * 10,
        ) / 10

  const fullData = {
    sleeps: allSleeps,
    metrics: allMetrics,
    activities: allActivities,
    trainings: allTrainings,
    weights: [...allWeights, ...(confounders.weights || [])],
    recoveries: confounders.recoveries || [],
    dayEntries: confounders.dayEntries || [],
  }

  // Horizons relative to `to`. Live path ledger is clipped to loadFrom…to (~window+90d),
  // so 12m would be empty/misleading — drop it here. Offline stored reports keep full horizons.
  const periods = analyzePeriods(fullData, {
    asOf,
    horizonsMonths: [1, 3, 6],
  })

  const causal = analyzeCausal(daily, {
    recoveries: data.recoveries,
    dayEntries: data.dayEntries,
    weights: data.weights,
  })

  // Soft lab confounder block — additive only; does not touch periodCausal alcohol helpers.
  // labsSummary loaded in the post-ledger Promise.all wave (or null on failure).
  const labSoft = labsSummary?.present
    ? {
        present: true as const,
        panelId: labsSummary.panelId,
        drawDate: labsSummary.drawDate,
        flaggedCount: labsSummary.flaggedCount,
        chipLabel: labsSummary.chipLabel,
        summary: labsSummary.summary,
        disclaimer: labsSummary.disclaimer,
        confidenceNote:
          'Low-confidence lab context only — what we don’t know from serum vs wearables. Not a diagnosis.',
      }
    : {
        present: false as const,
        panelId: null,
        drawDate: null,
        flaggedCount: 0,
        chipLabel: 'No labs yet',
        summary: '',
        disclaimer:
          labsSummary?.disclaimer ??
          'Educational self-tracking only — not a diagnosis or medical advice. Discuss results with your clinician.',
        confidenceNote:
          'No blood panel on file — lab confounders unavailable for this window.',
      }

  const theRead = {
    verdict:
      avgForm == null ? null : avgForm >= 65 ? 'good' : avgForm >= 45 ? 'mixed' : 'bad',
    /** WP 2.2 alias — prefer `tone` in new UI to avoid clash with Verdict page. */
    tone:
      avgForm == null ? null : avgForm >= 65 ? 'good' : avgForm >= 45 ? 'mixed' : 'bad',
    avgForm,
    /** Mean input count among days that cleared FORM_MIN_INPUTS (null when Form suppressed). */
    avgFormInputs,
    formSignalCount: FORM_SIGNAL_COUNT,
    leadingCause: causal.topHypothesis
      ? {
          id: causal.topHypothesis.id,
          label: causal.topHypothesis.label,
          confidence: causal.topHypothesis.confidence,
        }
      : null,
    // Window-scoped causal patterns only — periods.topPatterns is multi-month / all-history
    // and was reprinting stale RHR-drinking Risk on every short Read.
    topRisk: pickDistinctTopRisk(
      causal.patterns as RiskPattern[] | undefined,
      causal.topHypothesis
        ? { id: causal.topHypothesis.id, label: causal.topHypothesis.label }
        : null,
    ),
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
    headline: formatTheReadHeadline(periods.headline),
  }

  return {
    from,
    to,
    asOf,
    theRead,
    series,
    /** Foster monotony/strain for the 7 days ending `to`. */
    fosterWeek,
    /** Latest Fitness/Freshness point in window (convenience). */
    fitnessFreshness: (() => {
      const last = [...series].reverse().find(s => s.ctl != null)
      if (!last || last.ctl == null) return null
      return {
        date: last.date,
        ctl: last.ctl,
        atl: last.atl,
        tsb: last.tsb,
        acwr: last.acwr,
        note: 'CTL/ATL/TSB from Banister EWMA on daily PLU. Distinct from cockpit formScore.',
      }
    })(),
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
      labSoft,
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
      foodDays: foodLoggedDays,
      metricKinds: metricKindCounts,
    },
  }
}
