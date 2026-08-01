import { describe, expect, it } from 'vitest'
import {
  buildFitnessSeries,
  edwardsFromAvgHr,
  edwardsFromHrStream,
  ewmaAlpha,
  fosterMonotonyStrain,
  fosterWeekEnding,
  gradeAdjustedPace,
  gradeAdjustedPaceFromTotals,
  minettiRunningCost,
  peakRollingAverages,
  sessionEfficiency,
} from '@/lib/engines/trainingMetrics'

describe('ewmaAlpha', () => {
  it('matches 1 − e^(−1/τ)', () => {
    expect(ewmaAlpha(42)).toBeCloseTo(1 - Math.exp(-1 / 42), 10)
    expect(ewmaAlpha(7)).toBeCloseTo(1 - Math.exp(-1 / 7), 10)
  })
})

describe('buildFitnessSeries', () => {
  it('fills zero days and raises CTL slower than ATL after a spike', () => {
    const series = buildFitnessSeries(
      [
        { date: '2026-06-01', load: 0 },
        { date: '2026-06-02', load: 100 },
        { date: '2026-06-03', load: 0 },
      ],
      { from: '2026-06-01', to: '2026-06-03' },
    )
    expect(series).toHaveLength(3)
    expect(series[1].load).toBe(100)
    expect(series[1].atl).toBeGreaterThan(series[1].ctl)
    expect(series[1].tsb).toBeLessThan(0)
    // After a rest day, fatigue decays faster → TSB recovers toward zero/positive
    expect(series[2].atl).toBeLessThan(series[1].atl)
    expect(series[2].tsb).toBeGreaterThan(series[1].tsb)
  })

  it('reports ACWR once chronic EWMA warms up', () => {
    // Need ≫ chronic τ so both limbs reach the same steady state.
    const loads = Array.from({ length: 120 }, (_, i) => {
      const dt = new Date(Date.UTC(2026, 0, 1 + i))
      return {
        date: dt.toISOString().slice(0, 10),
        load: 50,
      }
    })
    const series = buildFitnessSeries(loads)
    const last = series[series.length - 1]
    expect(last.acwr).not.toBeNull()
    expect(last.acwr!).toBeCloseTo(1, 1)
    expect(last.ctl).toBeGreaterThan(40)
  })
})

describe('fosterMonotonyStrain', () => {
  it('scores varied weeks lower monotony than flat weeks', () => {
    const varied = fosterMonotonyStrain([10, 80, 20, 90, 15, 70, 25], {
      from: '2026-06-01',
      to: '2026-06-07',
    })
    const flat = fosterMonotonyStrain([50, 50, 50, 50, 50, 50, 50], {
      from: '2026-06-01',
      to: '2026-06-07',
    })
    expect(varied.monotony).not.toBeNull()
    expect(varied.strain).not.toBeNull()
    // Flat non-zero → SD=0 → monotony null (undefined mathematically)
    expect(flat.monotony).toBeNull()
    expect(varied.weeklyLoad).toBe(310)
  })

  it('fosterWeekEnding fills missing days with zero', () => {
    const w = fosterWeekEnding(
      [
        { date: '2026-06-05', load: 100 },
        { date: '2026-06-07', load: 50 },
      ],
      '2026-06-07',
      7,
    )
    expect(w.from).toBe('2026-06-01')
    expect(w.weeklyLoad).toBe(150)
  })
})

describe('GAP (Minetti)', () => {
  it('Cr(0) is ~3.6 J/kg/m', () => {
    expect(minettiRunningCost(0)).toBeCloseTo(3.6, 5)
  })

  it('uphill makes GAP faster than actual pace', () => {
    const flat = gradeAdjustedPace({ speedMs: 3.33, grade: 0 })!
    const up = gradeAdjustedPace({ speedMs: 3.33, grade: 0.08 })!
    expect(up.costRatio).toBeGreaterThan(1)
    expect(up.gapPaceSecPerKm).toBeLessThan(flat.gapPaceSecPerKm)
    expect(up.gapPaceSecPerKm).toBeLessThan(up.actualPaceSecPerKm)
  })

  it('activity-level totals proxy works', () => {
    const r = gradeAdjustedPaceFromTotals({
      distanceM: 10000,
      durationSec: 3000,
      elevationGainM: 200,
    })
    expect(r).not.toBeNull()
    expect(r!.gapPaceSecPerKm).toBeLessThan(r!.actualPaceSecPerKm)
  })
})

describe('peakRollingAverages', () => {
  it('finds the best 5-sample mean in a spiked series', () => {
    const samples = [1, 1, 1, 10, 10, 10, 10, 10, 1, 1]
    const peaks = peakRollingAverages(samples, [5], 1)
    expect(peaks[0].peak).toBe(10)
  })

  it('returns null when window longer than stream', () => {
    const peaks = peakRollingAverages([1, 2, 3], [60], 1)
    expect(peaks[0].peak).toBeNull()
  })
})

describe('Edwards relative effort', () => {
  it('weights higher zones more', () => {
    const easy = edwardsFromAvgHr({ avgHr: 120, durationSec: 3600, hrMax: 185 })
    const hard = edwardsFromAvgHr({ avgHr: 170, durationSec: 3600, hrMax: 185 })
    expect(hard.relativeEffort).toBeGreaterThan(easy.relativeEffort)
  })

  it('accumulates from HR stream', () => {
    // 10 min at ~95% HRmax
    const hr = Array.from({ length: 600 }, () => 176)
    const r = edwardsFromHrStream(hr, { hrMax: 185, sampleHz: 1 })
    expect(r.minutesByZone[4]).toBeCloseTo(10, 0)
    expect(r.relativeEffort).toBeCloseTo(50, 0) // 10 min × zone 5
  })
})

describe('sessionEfficiency', () => {
  it('computes pace and kcal per km', () => {
    const e = sessionEfficiency({
      date: '2026-06-01',
      sport: 'run',
      distanceM: 10000,
      durationSec: 3000,
      calories: 700,
      avgHr: 150,
    })
    expect(e!.paceSecPerKm).toBe(300)
    expect(e!.kcalPerKm).toBe(70)
    expect(e!.hrPerKm).toBe(15)
  })
})
