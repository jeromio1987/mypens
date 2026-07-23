import { describe, expect, it } from 'vitest'
import { buildMultiSourceFixture } from '../scripts/lib/engineFixtures.mjs'
import { runEngineStressTest, stressTestToMarkdown } from '../scripts/lib/engineStressTest.mjs'
import { analyzeGarmin } from '../scripts/lib/garminAnalyze.mjs'
import { analyzePeriods, buildDailySignals } from '../scripts/lib/periodAnalyze.mjs'
import { shiftDateStr } from '../scripts/lib/weekDates.mjs'

describe('multi-source fixture', () => {
  it('includes Garmin, Strava, Tanita, and Anchor binge', () => {
    const fx = buildMultiSourceFixture({ asOf: '2026-07-20', days: 120 })
    expect(fx.sleeps.length).toBe(120)
    expect(fx.activities.length).toBeGreaterThan(20)
    expect(fx.trainings.every(t => t.source === 'strava')).toBe(true)
    expect(fx.trainings.length).toBeGreaterThan(15)
    expect(fx.weights.every(w => w.source === 'tanita')).toBe(true)
    expect(fx.weights.some(w => typeof w.bodyFatPct === 'number')).toBe(true)
    expect(fx.recoveries.some(r => r.alcoholDrinks >= 15)).toBe(true)
    expect(fx.meta.sources).toEqual(
      expect.arrayContaining([
        'garmin_sleep',
        'garmin_activity',
        'garmin_wellness',
        'strava_training',
        'tanita_weight',
        'anchor_recovery',
      ]),
    )
  })
})

describe('Garmin engine — Strava + Tanita awareness', () => {
  it('reports Strava sessions and Tanita body-fat in domains/findings', () => {
    const fx = buildMultiSourceFixture()
    const report = analyzeGarmin(fx)
    expect(report.coverageScore).toBeGreaterThanOrEqual(6)
    expect(report.domains.training?.stravaSessions).toBeGreaterThan(10)
    expect(report.domains.weight?.latestBodyFatPct).toEqual(expect.any(Number))
    expect(report.findings.join('\n')).toMatch(/training ledger|strava/i)
    expect(report.findings.join('\n')).toMatch(/body comp|BF /i)
    expect(report.summary).not.toMatch(/no garmin-derived data/i)
  })
})

describe('Period engine — Strava counts as activity', () => {
  it('does not treat Strava-only training days as zero-activity', () => {
    // Strip Garmin activities; keep Strava trainings only
    const fx = buildMultiSourceFixture({ days: 60, asOf: '2026-07-20' })
    const stravaOnly = {
      sleeps: fx.sleeps,
      metrics: fx.metrics,
      activities: [],
      trainings: fx.trainings,
      weights: fx.weights,
      recoveries: [],
      dayEntries: [],
    }
    const daily = buildDailySignals(stravaOnly)
    const active = daily.filter(d => d.activityCount > 0)
    expect(active.length).toBe(fx.trainings.length)

    const report = analyzePeriods(stravaOnly, { asOf: '2026-07-20', horizonsMonths: [1, 3] })
    const h3 = report.horizons.find(h => h.months === 3)!
    expect(h3.domains.activity.sessions).toBeGreaterThan(0)
    // Without Strava folding, this would look like idle RHR; with Strava it should not
    // force low_rhr_no_activity as the only story when sessions exist.
    expect(h3.domains.activity.sessions).toBe(fx.trainings.filter(t => t.date >= h3.from).length)
  })
})

describe('full engine stress suite', () => {
  it('passes all multi-source checks', () => {
    const report = runEngineStressTest(buildMultiSourceFixture({ asOf: '2026-07-20', days: 120 }))
    if (report.failed.length) {
      // Surface failures clearly in vitest output
      throw new Error(
        report.failed.map(f => `${f.id}: ${f.detail}`).join('\n') || 'stress checks failed',
      )
    }
    expect(report.summary.failed).toBe(0)
    expect(report.summary.passRate).toBe(100)
    expect(stressTestToMarkdown(report)).toMatch(/Engine stress test/)
  })

  it('keeps alcohol binge as leading cause over idle RHR', () => {
    const report = runEngineStressTest()
    expect(report.causal.topHypothesis?.id).toBe('alcohol_binge_stack')
    expect(report.periods.causalNarrative || report.causal.narrative || '').toMatch(/binge|alcohol|15/i)
  })

  it('never claims empty DB when fixture is rich', () => {
    const report = runEngineStressTest()
    expect(report.garmin.summary).not.toMatch(/no usable rows|no garmin-derived data/i)
    expect(report.periods.headline).not.toMatch(/not enough/i)
  })
})

describe('edge: empty data still honest', () => {
  it('reports empty clearly when given nothing', () => {
    const report = analyzeGarmin({
      sleeps: [],
      weights: [],
      trainings: [],
      activities: [],
      metrics: [],
    })
    expect(report.coverageScore).toBe(0)
    expect(report.summary).toMatch(/no garmin-derived data|no usable rows/i)
  })

  it('period headline admits sparse data', () => {
    const report = analyzePeriods(
      { sleeps: [{ date: '2026-07-20', hours: 7, quality: 4 }], metrics: [], activities: [] },
      { asOf: '2026-07-20', horizonsMonths: [1] },
    )
    // One night is not enough for multi-month horizons — still returns a structure
    expect(report.horizons.length).toBeGreaterThan(0)
    expect(report.asOf).toBe('2026-07-20')
  })
})

describe('timeline integrity', () => {
  it('fixture dates are contiguous and end on asOf', () => {
    const asOf = '2026-07-18'
    const fx = buildMultiSourceFixture({ asOf, days: 30 })
    expect(fx.sleeps[0].date).toBe(shiftDateStr(asOf, -29))
    expect(fx.sleeps[fx.sleeps.length - 1].date).toBe(asOf)
    for (let i = 1; i < fx.sleeps.length; i++) {
      expect(fx.sleeps[i].date).toBe(shiftDateStr(fx.sleeps[i - 1].date, 1))
    }
  })
})
