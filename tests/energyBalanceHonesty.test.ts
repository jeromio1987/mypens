import { describe, expect, it } from 'vitest'
import { dayIncompleteCapture } from '../lib/energyBalance'
import {
  FORM_MIN_INPUTS,
  FORM_SIGNAL_COUNT,
  scoreDay,
} from '../scripts/lib/periodAnalyze.mjs'

describe('dayIncompleteCapture — food coverage honesty', () => {
  it('flags zero-food days so UI can hide bold delta (−BMR artefact)', () => {
    expect(
      dayIncompleteCapture({
        foodIncomplete: false,
        foodCoverage: false,
        sessionCount: 0,
        eatKcal: 0,
        sessionsMissingKcal: 0,
      }),
    ).toBe(true)
  })

  it('clears when food is logged and sessions have kcal', () => {
    expect(
      dayIncompleteCapture({
        foodIncomplete: false,
        foodCoverage: true,
        sessionCount: 2,
        eatKcal: 400,
        sessionsMissingKcal: 0,
      }),
    ).toBe(false)
  })

  it('ORs foodIncomplete and missing session kcal', () => {
    expect(
      dayIncompleteCapture({
        foodIncomplete: true,
        foodCoverage: true,
        sessionCount: 0,
        eatKcal: 0,
        sessionsMissingKcal: 0,
      }),
    ).toBe(true)
    expect(
      dayIncompleteCapture({
        foodIncomplete: false,
        foodCoverage: true,
        sessionCount: 1,
        eatKcal: 0,
        sessionsMissingKcal: 1,
      }),
    ).toBe(true)
  })
})

describe('scoreDay — form input coverage', () => {
  it('returns score + formInputs; single signal is disclosed', () => {
    const one = scoreDay({
      sleepHours: 7.5,
      stress: null,
      hrv: null,
      steps: null,
      activityCount: 0,
    })
    expect(one).toEqual({ score: 95, formInputs: 1 })
    expect(one.formInputs).toBeLessThan(FORM_MIN_INPUTS)
  })

  it('counts up to FORM_SIGNAL_COUNT independent inputs', () => {
    const full = scoreDay({
      sleepHours: 7.5,
      stress: 25,
      hrv: 60,
      steps: 9000,
      activityCount: 1,
      trainingLoad: 40,
      activityMinutes: 40,
    })
    expect(full.formInputs).toBe(FORM_SIGNAL_COUNT)
    expect(full.score).toBeGreaterThan(50)
  })

  it('returns null when no signals', () => {
    expect(
      scoreDay({
        sleepHours: null,
        stress: null,
        hrv: null,
        steps: null,
        activityCount: 0,
      }),
    ).toBeNull()
  })
})
