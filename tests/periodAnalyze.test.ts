import { describe, expect, it } from 'vitest'
import {
  analyzePeriods,
  classifyScore,
  findSegments,
  buildWeeklyScores,
  buildDailySignals,
  nestedBreakdown,
  interpretPatterns,
  domainStats,
  crossMetricMatrix,
  scoreDay,
  FORM_MIN_INPUTS,
} from '../scripts/lib/periodAnalyze.mjs'
import { shiftDateStr } from '../scripts/lib/weekDates.mjs'

/** Sleep nights plus a second Form signal (stress) so FORM_MIN_INPUTS honesty gate is met. */
function formDays(
  from: string,
  nights: number,
  hours: number,
  stress: number,
) {
  const sleeps = []
  const metrics = []
  let d = from
  for (let i = 0; i < nights; i++) {
    sleeps.push({ date: d, hours, quality: 4 })
    metrics.push({ date: d, kind: 'stress', valueNum: stress })
    d = shiftDateStr(d, 1)
  }
  return { sleeps, metrics }
}

describe('buildDailySignals HRV/stress sources', () => {
  it('uses SleepEntry.hrv when metric hrv is missing', () => {
    const daily = buildDailySignals({
      sleeps: [{ date: '2026-06-01', hours: 7.2, quality: 4, hrv: 51 }],
      metrics: [{ date: '2026-06-01', kind: 'steps', valueNum: 8000 }],
      activities: [],
    })
    expect(daily[0].hrv).toBe(51)
    expect(daily[0].steps).toBe(8000)
  })

  it('maps kind aliases for stress and hrv', () => {
    const daily = buildDailySignals({
      sleeps: [],
      metrics: [
        { date: '2026-06-02', kind: 'average_stress', valueNum: 37 },
        { date: '2026-06-02', kind: 'sleeping_hrv', valueNum: 44 },
      ],
      activities: [],
    })
    expect(daily[0].stress).toBe(37)
    expect(daily[0].hrv).toBe(44)
  })
})

describe('FORM_MIN_INPUTS honesty gate', () => {
  it('scores sleep-only days but marks thin formInputs (< gate)', () => {
    const scored = scoreDay({ sleepHours: 7.5 })
    expect(scored).not.toBeNull()
    expect(scored!.formInputs).toBe(1)
    expect(scored!.formInputs).toBeLessThan(FORM_MIN_INPUTS)
  })

  it('excludes sleep-only days from weekly Form stretches', () => {
    const daily = buildDailySignals({
      sleeps: Array.from({ length: 14 }, (_, i) => ({
        date: shiftDateStr('2026-01-05', i),
        hours: 7.8,
        quality: 4,
      })),
      metrics: [],
      activities: [],
    })
    const weekly = buildWeeklyScores(daily)
    expect(weekly).toHaveLength(0)
  })

  it('includes multi-signal days in weekly Form', () => {
    const scored = scoreDay({ sleepHours: 7.5, stress: 25 })
    expect(scored!.formInputs).toBeGreaterThanOrEqual(FORM_MIN_INPUTS)
    expect(classifyScore(scored!.score)).toBe('good')
  })
})

describe('period segments — 3m good then 9m bad', () => {
  it('12-month verdict is bad while naming the good stretch', () => {
    // ~13 weeks strong Form (sleep+stress), then ~39 weeks weak (~12 months)
    const good = formDays('2025-07-07', 91, 7.5, 25) // ~3 months
    const bad = formDays('2025-10-06', 273, 5.2, 65) // ~9 months
    const data = {
      sleeps: [...good.sleeps, ...bad.sleeps],
      metrics: [...good.metrics, ...bad.metrics],
      activities: [],
    }

    const report = analyzePeriods(data, { asOf: '2026-07-06', horizonsMonths: [3, 12] })
    const h12 = report.horizons.find(h => h.months === 12)!
    const h3 = report.horizons.find(h => h.months === 3)!

    expect(h12.verdict).toBe('bad')
    expect(h3.verdict).toBe('bad') // recent 3m are the weak ones
    expect(h12.nested?.longestGood).toBeTruthy()
    expect(h12.nested?.longestBad).toBeTruthy()
    expect(h12.nested!.longestGood!.approxMonths).toBeGreaterThanOrEqual(2)
    expect(h12.nested!.longestBad!.approxMonths).toBeGreaterThanOrEqual(6)

    const contrast = h12.advice.find(a => a.kind === 'contrast')
    expect(contrast?.text).toMatch(/good stretch/i)
    expect(contrast?.text).toMatch(/12 month/i)

    // Discussing only the good stretch still labels it good
    const goodSeg = report.segments.find(s => s.verdict === 'good')
    expect(goodSeg).toBeTruthy()
    expect(goodSeg!.verdict).toBe('good')
  })

  it('merges adjacent weeks into stretches', () => {
    const { sleeps, metrics } = formDays('2026-01-05', 28, 7.8, 25)
    const daily = buildDailySignals({
      sleeps,
      metrics,
      activities: [],
    })
    const weekly = buildWeeklyScores(daily)
    const segs = findSegments(weekly)
    expect(segs.length).toBe(1)
    expect(segs[0].verdict).toBe('good')
    expect(segs[0].weeks).toBeGreaterThanOrEqual(3)
  })
})

describe('nestedBreakdown', () => {
  it('explains good-then-bad inside a labeled window', () => {
    const nested = nestedBreakdown(
      [
        { verdict: 'good', from: '2025-07-07', to: '2025-10-05', weeks: 13, approxMonths: 3, avgScore: 80 },
        { verdict: 'bad', from: '2025-10-06', to: '2026-07-06', weeks: 39, approxMonths: 9, avgScore: 30 },
      ],
      'last 12 months',
    )
    expect(nested?.note).toMatch(/3-month good/)
    expect(nested?.note).toMatch(/9-month bad/)
    expect(nested?.note).toMatch(/full last 12 months/)
  })
})

describe('deep patterns — RHR 53 + no activity', () => {
  it('calls out recovery illusion when RHR is low and sessions are zero', () => {
    const days = []
    let d = '2026-06-01'
    for (let i = 0; i < 21; i++) {
      days.push({
        date: d,
        sleepHours: 7.4,
        sleepQuality: 4,
        stress: 28,
        hrv: 55,
        restingHr: 53,
        steps: 3200,
        bodyBatteryMax: 70,
        activityMinutes: 0,
        activityCount: 0,
      })
      d = shiftDateStr(d, 1)
    }
    const domains = domainStats(days)
    const cross = crossMetricMatrix(days)
    const patterns = interpretPatterns(domains, cross, days)
    const hit = patterns.find(p => p.id === 'low_rhr_no_activity')
    expect(hit).toBeTruthy()
    expect(hit!.text).toMatch(/recovery illusion|under-loading|not being challenged/i)
    expect(hit!.text).toMatch(/53/)

    const report = analyzePeriods(
      {
        sleeps: days.map(x => ({ date: x.date, hours: x.sleepHours, quality: 4 })),
        metrics: days.flatMap(x => [
          { date: x.date, kind: 'resting_hr', valueNum: x.restingHr },
          { date: x.date, kind: 'stress', valueNum: x.stress },
          { date: x.date, kind: 'hrv', valueNum: x.hrv },
          { date: x.date, kind: 'steps', valueNum: x.steps },
        ]),
        activities: [],
      },
      { asOf: '2026-06-21', horizonsMonths: [1] },
    )
    expect(report.deepAnalysis).toMatch(/resting HR|RHR|activity/i)
    const h1 = report.horizons.find(h => h.months === 1)!
    expect(h1.analysis.length).toBeGreaterThan(200)
    expect(h1.patterns.some(p => p.id === 'low_rhr_no_activity')).toBe(true)
  })
})