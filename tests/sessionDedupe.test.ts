import { describe, expect, it } from 'vitest'
import {
  dedupeSessions,
  parseTrainingWindow,
  sessionPreference,
  sessionsOverlap,
} from '../lib/sessionDedupe'
import { dayTrainingLoad } from '../scripts/lib/trainingLoad.mjs'
import { resolveActiveCalories, resolveSteps } from '../lib/dayMetricPrecedence'

describe('dedupeSessions', () => {
  it('drops overlapping HC Google Fit when Garmin HC package wins', () => {
    const start = Date.parse('2026-07-20T08:00:00.000Z')
    const end = Date.parse('2026-07-20T09:00:00.000Z')
    const kept = dedupeSessions([
      {
        id: 'hc-google',
        startMs: start,
        endMs: end,
        durationSec: 3600,
        source: 'healthconnect',
        preference: sessionPreference('training', 'healthconnect', 'com.google.android.apps.fitness'),
        kcal: 400,
      },
      {
        id: 'hc-garmin',
        startMs: start + 60_000,
        endMs: end,
        durationSec: 3540,
        source: 'healthconnect',
        preference: sessionPreference('training', 'healthconnect', 'com.garmin.android.apps.connectmobile'),
        kcal: 420,
      },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]!.id).toBe('hc-garmin')
  })

  it('prefers FIT archive over overlapping Strava training (E4)', () => {
    const start = Date.parse('2026-07-20T10:00:00.000Z')
    const end = Date.parse('2026-07-20T12:00:00.000Z')
    const kept = dedupeSessions([
      {
        id: 'strava',
        startMs: start,
        endMs: end,
        durationSec: 7200,
        source: 'strava',
        preference: sessionPreference('training', 'strava'),
        kcal: 900,
      },
      {
        id: 'fit',
        startMs: start,
        endMs: end,
        durationSec: 7200,
        source: 'garmin_activity',
        preference: sessionPreference('garmin_activity'),
        kcal: 880,
      },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]!.id).toBe('fit')
  })

  it('keeps non-overlapping evening session when morning FIT exists (E5)', () => {
    const morning = {
      startMs: Date.parse('2026-07-20T08:00:00.000Z'),
      endMs: Date.parse('2026-07-20T09:00:00.000Z'),
    }
    const evening = {
      startMs: Date.parse('2026-07-20T18:00:00.000Z'),
      endMs: Date.parse('2026-07-20T19:00:00.000Z'),
    }
    expect(sessionsOverlap({ ...morning, durationSec: 3600 }, { ...evening, durationSec: 3600 })).toBe(
      false,
    )
    const kept = dedupeSessions([
      {
        id: 'fit-am',
        ...morning,
        durationSec: 3600,
        source: 'garmin_activity',
        preference: sessionPreference('garmin_activity'),
        kcal: 500,
      },
      {
        id: 'gym-pm',
        ...evening,
        durationSec: 3600,
        source: 'garmin',
        preference: sessionPreference('training', 'garmin'),
        kcal: 300,
      },
    ])
    expect(kept).toHaveLength(2)
  })

  it('keeps untimed same-day sessions (no synthetic noon collapse)', () => {
    const kept = dedupeSessions([
      {
        id: 'walk',
        startMs: null,
        endMs: null,
        durationSec: 7200,
        source: 'garmin_activity',
        preference: sessionPreference('garmin_activity'),
        kcal: 200,
      },
      {
        id: 'run',
        startMs: null,
        endMs: null,
        durationSec: 2400,
        source: 'garmin_activity',
        preference: sessionPreference('garmin_activity'),
        kcal: 400,
      },
    ])
    expect(kept).toHaveLength(2)
  })
})

describe('parseTrainingWindow', () => {
  it('reads HC start/end from externalRaw', () => {
    const w = parseTrainingWindow(
      JSON.stringify({
        startTime: '2026-07-20T08:00:00.000Z',
        endTime: '2026-07-20T09:00:00.000Z',
        packageName: 'com.garmin.android.apps.connectmobile',
      }),
    )
    expect(w.startMs).toBe(Date.parse('2026-07-20T08:00:00.000Z'))
    expect(w.durationSec).toBe(3600)
    expect(w.packageName).toMatch(/garmin/)
  })
})

describe('dayTrainingLoad dedup (T1)', () => {
  it('does not double-count overlapping FIT + Strava', () => {
    const start = '2026-07-20T10:00:00.000Z'
    const double = dayTrainingLoad(
      [
        {
          id: 'fit1',
          date: '2026-07-20',
          sport: 'cycling',
          name: 'Ride',
          durationSec: 3600,
          avgHr: 140,
          startedAt: start,
          calories: 800,
        },
      ],
      [
        {
          id: 'strava1',
          date: '2026-07-20',
          exercise: 'Ride',
          source: 'strava',
          durationMin: 60,
          externalRaw: JSON.stringify({
            startTime: start,
            endTime: '2026-07-20T11:00:00.000Z',
            elapsed_time: 3600,
          }),
          calories: 820,
        },
      ],
    )
    const once = dayTrainingLoad(
      [
        {
          id: 'fit1',
          date: '2026-07-20',
          sport: 'cycling',
          name: 'Ride',
          durationSec: 3600,
          avgHr: 140,
          startedAt: start,
          calories: 800,
        },
      ],
      [],
    )
    expect(double.activityCount).toBe(1)
    expect(double.trainingLoad).toBeCloseTo(once.trainingLoad, 0)
  })
})

describe('dayMetricPrecedence (D1)', () => {
  it('prefers Garmin steps over HC side-kind', () => {
    expect(
      resolveSteps([
        { kind: 'steps', valueNum: 12000, sourceFile: 'garmin_dailies.json' },
        { kind: 'steps_hc', valueNum: 8000, sourceFile: 'healthconnect' },
      ]),
    ).toBe(12000)
  })

  it('falls back to steps_hc when Garmin missing', () => {
    expect(resolveSteps([{ kind: 'steps_hc', valueNum: 9000, sourceFile: 'healthconnect' }])).toBe(
      9000,
    )
  })

  it('prefers Garmin active over legacy HC-on-active row', () => {
    expect(
      resolveActiveCalories([
        {
          kind: 'active_calories',
          valueNum: 400,
          sourceFile: 'healthconnect',
          raw: JSON.stringify({ source: 'healthconnect' }),
        },
        { kind: 'active_calories', valueNum: 900, sourceFile: 'UDSFile.json' },
      ]),
    ).toBe(900)
  })
})
