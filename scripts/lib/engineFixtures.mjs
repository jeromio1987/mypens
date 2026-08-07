// =============================================================================
// Multi-source engine fixtures — Garmin + Strava + Tanita shaped rows
//
// Used to stress-test analyzeGarmin / analyzePeriods / analyzeCausal without
// requiring live Supabase. Shapes match what the dump importer + Strava sync
// + Tanita CSV path actually write.
// =============================================================================

import { shiftDateStr } from './weekDates.mjs'

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function round1(n) {
  return Math.round(n * 10) / 10
}

/**
 * Build ~N days of multi-source health data ending on `asOf`.
 *
 * Story arc (deterministic):
 *  - Early third: strong sleep, Garmin runs + Strava lifts, falling body fat
 *  - Mid: one Anchor binge (15 drinks) + hangover idle week
 *  - Late third: shorter sleep, fewer sessions, stress up, BF flat/up
 *
 * @param {{ asOf?: string, days?: number }} [opts]
 */
export function buildMultiSourceFixture(opts = {}) {
  const asOf = opts.asOf || '2026-07-20'
  const days = opts.days || 120
  const start = shiftDateStr(asOf, -(days - 1))

  const sleeps = []
  const metrics = []
  const activities = []
  const trainings = []
  const weights = []
  const recoveries = []
  const dayEntries = []

  let d = start
  let scaleKg = 86.2
  let bodyFat = 20.4

  for (let i = 0; i < days; i++) {
    const phase = i / days // 0 → 1
    const bingeDay = i === Math.floor(days * 0.78)
    const hangoverWindow = i > Math.floor(days * 0.78) && i <= Math.floor(days * 0.78) + 4

    // --- Sleep (Garmin Connect dump shape) ---
    let hours = phase < 0.45 ? 7.6 - phase * 0.3 : 6.2 - (phase - 0.45) * 1.2
    if (hangoverWindow) hours = 5.1 + (i % 2) * 0.4
    hours = round1(clamp(hours + ((i % 5) - 2) * 0.15, 4.5, 8.8))
    const quality = hours >= 7 ? 4 : hours >= 6 ? 3 : 2
    sleeps.push({ date: d, hours, quality, hrv: null, bedtime: '23:00', wakeTime: '06:30' })

    // --- Wellness (GarminDailyMetric) ---
    let stress = phase < 0.45 ? 26 + phase * 10 : 38 + phase * 25
    let hrv = phase < 0.45 ? 62 - phase * 8 : 48 - phase * 20
    let rhr = phase < 0.45 ? 52 + phase * 3 : 54 + phase * 6
    let steps = phase < 0.45 ? 9200 - phase * 1000 : 4800 - phase * 1500
    if (hangoverWindow) {
      stress += 18
      hrv -= 18
      rhr += 8
      steps = 1800 + (i % 3) * 400
    }
    stress = round1(clamp(stress, 15, 85))
    hrv = round1(clamp(hrv, 22, 80))
    rhr = round1(clamp(rhr, 48, 72))
    steps = Math.round(clamp(steps, 800, 14000))

    metrics.push(
      { date: d, kind: 'stress', valueNum: stress, unit: 'score' },
      { date: d, kind: 'hrv', valueNum: hrv, unit: 'ms' },
      { date: d, kind: 'resting_hr', valueNum: rhr, unit: 'bpm' },
      { date: d, kind: 'steps', valueNum: steps, unit: 'count' },
      { date: d, kind: 'body_battery_max', valueNum: round1(clamp(90 - stress * 0.6, 25, 95)), unit: 'score' },
    )

    // --- Garmin activities (archive / Connect JSON) ---
    const doGarminRun = !hangoverWindow && phase < 0.7 && i % 3 === 0
    const doGarminStrength = !hangoverWindow && phase < 0.5 && i % 5 === 1
    if (doGarminRun) {
      activities.push({
        date: d,
        sport: 'running',
        name: 'Easy run',
        durationSec: 2400 + (i % 4) * 300,
        distanceM: 5000 + (i % 4) * 800,
        avgHr: 138 + (i % 5),
        calories: 380 + (i % 5) * 20,
      })
    }
    if (doGarminStrength) {
      activities.push({
        date: d,
        sport: 'strength_training',
        name: 'Garmin strength',
        durationSec: 3600,
        distanceM: 0,
        avgHr: 118,
        calories: 320,
      })
    }

    // --- Strava TrainingEntry ledger (strength imports) ---
    const doStrava = !hangoverWindow && i % 4 === 2 && phase < 0.85
    if (doStrava) {
      const sets = 4
      const reps = 8
      const weightKg = 80 + (i % 6) * 2.5
      trainings.push({
        date: d,
        exercise: 'Back Squat',
        sets,
        reps,
        weightKg,
        volume: sets * reps * weightKg,
        source: 'strava',
        externalId: `strava_fixture_${d}`,
        externalUrl: `https://www.strava.com/activities/fixture_${d.replace(/-/g, '')}`,
      })
    }

    // --- Tanita weigh-ins every 3rd day ---
    if (i % 3 === 0) {
      if (phase < 0.5) {
        scaleKg -= 0.04
        bodyFat -= 0.02
      } else if (hangoverWindow) {
        scaleKg += 0.35 // water
      } else {
        scaleKg += 0.03
        bodyFat += 0.015
      }
      const kg = round1(scaleKg)
      const bf = round1(clamp(bodyFat, 14, 28))
      weights.push({
        date: d,
        scaleKg: kg,
        trueWeightKg: round1(kg - (hangoverWindow ? 0.6 : 0.1)),
        bodyFatPct: bf,
        muscleMassKg: round1(kg * (1 - bf / 100) * 0.55),
        bodyWaterPct: round1(52 + (hangoverWindow ? -1.5 : 0.2)),
        visceralFat: 7,
        alcoholUnits: bingeDay ? 15 : 0,
        hoursSinceAlcohol: bingeDay ? 6 : 48,
        source: 'tanita',
        tanitaReliable: !hangoverWindow,
      })
    }

    // --- Anchor binge ---
    if (bingeDay) {
      recoveries.push({
        date: d,
        alcoholDrinks: 15,
        cocaineUsed: false,
        escortUsed: false,
        mood: 2,
        energy: 2,
      })
      dayEntries.push({ date: d, tags: JSON.stringify(['alcohol', 'late_night']) })
    }

    d = shiftDateStr(d, 1)
  }

  return {
    asOf,
    meta: {
      days,
      start,
      end: asOf,
      sources: ['garmin_sleep', 'garmin_activity', 'garmin_wellness', 'strava_training', 'tanita_weight', 'anchor_recovery'],
      bingeDate: shiftDateStr(start, Math.floor(days * 0.78)),
    },
    sleeps,
    metrics,
    activities,
    trainings,
    weights,
    recoveries,
    dayEntries,
  }
}
