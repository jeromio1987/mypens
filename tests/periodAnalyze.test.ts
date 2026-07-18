import { describe, expect, it } from 'vitest'
import {
  analyzePeriods,
  classifyScore,
  findSegments,
  buildWeeklyScores,
  buildDailySignals,
  nestedBreakdown,
} from '../scripts/lib/periodAnalyze.mjs'
import { shiftDateStr } from '../scripts/lib/weekDates.mjs'

function sleepDays(from: string, nights: number, hours: number) {
  const out = []
  let d = from
  for (let i = 0; i < nights; i++) {
    out.push({ date: d, hours, quality: 4 })
    d = shiftDateStr(d, 1)
  }
  return out
}

describe('classifyScore', () => {
  it('bands good / mixed / bad', () => {
    expect(classifyScore(70)).toBe('good')
    expect(classifyScore(50)).toBe('mixed')
    expect(classifyScore(30)).toBe('bad')
  })
})

describe('period segments — 3m good then 9m bad', () => {
  it('12-month verdict is bad while naming the good stretch', () => {
    // ~13 weeks strong sleep, then ~39 weeks short sleep (~12 months)
    const good = sleepDays('2025-07-07', 91, 7.5) // ~3 months
    const bad = sleepDays('2025-10-06', 273, 5.2) // ~9 months
    const data = { sleeps: [...good, ...bad], metrics: [], activities: [] }

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
    const daily = buildDailySignals({
      sleeps: sleepDays('2026-01-05', 28, 7.8),
      metrics: [],
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
