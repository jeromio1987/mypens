import { describe, expect, it } from 'vitest'
import { shiftDateStr } from '../scripts/lib/weekDates.mjs'
import {
  analyzeCausal,
  classifyDrinkLoad,
  attachConfounders,
  lagEffects,
} from '../scripts/lib/periodCausal.mjs'
import { analyzePeriods } from '../scripts/lib/periodAnalyze.mjs'

describe('classifyDrinkLoad', () => {
  it('marks 15 beers as binge', () => {
    expect(classifyDrinkLoad(15)).toBe('binge')
    expect(classifyDrinkLoad(10)).toBe('binge')
    expect(classifyDrinkLoad(6)).toBe('heavy')
    expect(classifyDrinkLoad(0)).toBe('clean')
  })
})

describe('15 beers + no activity + RHR 53', () => {
  it('ranks alcohol binge over idle recovery-illusion', () => {
    const days = []
    let d = '2026-06-01'
    for (let i = 0; i < 14; i++) {
      days.push({
        date: d,
        sleepHours: 7.2,
        stress: 30,
        hrv: 52,
        restingHr: 53,
        steps: 2800,
        activityMinutes: 0,
        activityCount: 0,
      })
      d = shiftDateStr(d, 1)
    }
    // binge night, then hangover idle with slightly higher RHR / lower HRV
    const bingeDate = '2026-06-10'
    const recoveries = [{ date: bingeDate, alcoholDrinks: 15, cocaineUsed: false, escortUsed: false }]
    const enriched = attachConfounders(days, { recoveries, dayEntries: [], weights: [] })
    expect(enriched.find(x => x.date === bingeDate)?.isBinge).toBe(true)

    const causal = analyzeCausal(days, {
      recoveries,
      domains: {
        activity: { sessions: 0, activeDays: 0, zeroActivityShare: 1, daysInWindow: 14 },
        restingHr: { latest: 53, avg: 53 },
        sleep: { avgHours: 7.2, shortNights: 0 },
        stress: { avg: 30, highDays: 0 },
      },
    })

    expect(causal.topHypothesis?.id).toBe('alcohol_binge_stack')
    expect(causal.narrative).toMatch(/15|binge/i)
    expect(causal.narrative).toMatch(/not.*athletic calm|leading explanation|hangover/i)

    const report = analyzePeriods(
      {
        sleeps: days.map(x => ({ date: x.date, hours: x.sleepHours, quality: 4 })),
        metrics: days.flatMap(x => [
          { date: x.date, kind: 'resting_hr', valueNum: x.restingHr },
          { date: x.date, kind: 'hrv', valueNum: x.hrv },
          { date: x.date, kind: 'stress', valueNum: x.stress },
          { date: x.date, kind: 'steps', valueNum: x.steps },
        ]),
        activities: [],
        recoveries,
      },
      { asOf: '2026-06-14', horizonsMonths: [1] },
    )

    const h1 = report.horizons.find(h => h.months === 1)!
    expect(h1.causal?.topHypothesis?.id).toBe('alcohol_binge_stack')
    expect(h1.patterns.some(p => p.id === 'low_rhr_no_activity')).toBe(false)
    expect(h1.analysis).toMatch(/drink|binge|alcohol/i)
  })

  it('computes next-day lag after drink days', () => {
    const daily = attachConfounders(
      [
        { date: '2026-06-10', restingHr: 52, hrv: 60, stress: 25, sleepHours: 7, steps: 8000, activityCount: 1, activityMinutes: 40 },
        { date: '2026-06-11', restingHr: 62, hrv: 35, stress: 48, sleepHours: 5.5, steps: 2000, activityCount: 0, activityMinutes: 0 },
        { date: '2026-06-12', restingHr: 54, hrv: 55, stress: 28, sleepHours: 7.2, steps: 7000, activityCount: 0, activityMinutes: 0 },
      ],
      { recoveries: [{ date: '2026-06-10', alcoholDrinks: 15 }] },
    )
    const lags = lagEffects(daily)
    expect(lags.afterDrink.n).toBeGreaterThanOrEqual(1)
    expect(lags.afterBinge.n).toBeGreaterThanOrEqual(1)
    expect(lags.examples.biggestBinges[0].drinks).toBe(15)
  })
})
