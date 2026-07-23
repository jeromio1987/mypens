import { describe, expect, it } from 'vitest'
import {
  activityLoad,
  classifySport,
  dayTrainingLoad,
  hrIntensityFactor,
  trainingEntryLoad,
} from '../scripts/lib/trainingLoad.mjs'
import { buildDailySignals, scoreDay } from '../scripts/lib/periodAnalyze.mjs'

describe('classifySport', () => {
  it('detects walks vs runs', () => {
    expect(classifySport('walking', null, 'Morning walk')).toBe('walk')
    expect(classifySport('running', null, 'Tempo')).toBe('run')
    expect(classifySport('cycling', 'road', null)).toBe('cycle')
    expect(classifySport('strength_training', null, 'Gym')).toBe('strength')
  })
})

describe('activityLoad', () => {
  it('down-weights a long walk vs a shorter hard run', () => {
    const walk = activityLoad({
      sport: 'walking',
      name: 'Easy stroll',
      durationSec: 90 * 60,
      avgHr: 95,
    })
    const run = activityLoad({
      sport: 'running',
      name: 'Threshold',
      durationSec: 45 * 60,
      avgHr: 165,
    })
    expect(walk.load).toBeLessThan(run.load)
    expect(walk.sportClass).toBe('walk')
    expect(run.sportClass).toBe('run')
  })

  it('uses Banister-style HR intensity when avgHr present', () => {
    const easy = hrIntensityFactor(110, { restingHr: 50, hrMax: 185 })!
    const hard = hrIntensityFactor(170, { restingHr: 50, hrMax: 185 })!
    expect(hard).toBeGreaterThan(easy)
  })
})

describe('trainingEntryLoad', () => {
  it('scales strength by RPE when present', () => {
    const easy = trainingEntryLoad({ exercise: 'Squat', volume: 4000, rpe: 5, durationMin: 50 })
    const hard = trainingEntryLoad({ exercise: 'Squat', volume: 4000, rpe: 9, durationMin: 50 })
    expect(hard.load).toBeGreaterThan(easy.load)
  })
})

describe('dayTrainingLoad + Form', () => {
  it('exposes trainingLoad on daily signals and prefers it over raw minutes', () => {
    const daily = buildDailySignals({
      sleeps: [{ date: '2026-06-01', hours: 7.5, quality: 4 }],
      metrics: [{ date: '2026-06-01', kind: 'resting_hr', valueNum: 48 }],
      activities: [
        {
          date: '2026-06-01',
          sport: 'walking',
          name: 'Walk',
          durationSec: 120 * 60,
          avgHr: 98,
        },
        {
          date: '2026-06-01',
          sport: 'running',
          name: 'Intervals',
          durationSec: 40 * 60,
          avgHr: 168,
        },
      ],
      trainings: [],
    })
    const d = daily[0]
    expect(d.activityMinutes).toBe(160)
    expect(d.trainingLoad).toBeGreaterThan(0)
    expect(d.trainingLoad).toBeLessThan(d.activityMinutes) // walks discounted
    expect(d.easyLoad).toBeGreaterThan(0)
    expect(d.hardLoad).toBeGreaterThan(0)

    const scored = dayTrainingLoad(
      [
        { sport: 'walking', durationSec: 120 * 60, avgHr: 98 },
        { sport: 'running', durationSec: 40 * 60, avgHr: 168 },
      ],
      [],
      { restingHr: 48 },
    )
    expect(scored.trainingLoad).toBe(d.trainingLoad)

    const form = scoreDay(d)
    expect(form).toBeGreaterThan(50)
  })
})
