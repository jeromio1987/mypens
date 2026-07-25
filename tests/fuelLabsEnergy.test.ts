import { describe, expect, it } from 'vitest'
import {
  extractKcalFromExternalRaw,
  extractKcalFromNotes,
  extractKcalFromTraining,
} from '../lib/energyBalance'
import { scalePortion } from '../lib/foodPortion'
import { inferFoodTags, softNutrientFlags, sumMicros } from '../lib/foodMicros'
import {
  flagRefRange,
  normalizeMarkerCode,
  softBloodworkRead,
} from '../lib/bloodworkFlags'

describe('extractKcalFromNotes', () => {
  it('parses Garmin-style notes', () => {
    expect(extractKcalFromNotes('Cycling · 92.1 km · 1840 kcal · 3:12')).toBe(1840)
  })
  it('returns null when missing', () => {
    expect(extractKcalFromNotes('easy spin')).toBeNull()
  })
})

describe('extractKcalFromExternalRaw', () => {
  it('prefers activeKilocalories', () => {
    expect(extractKcalFromExternalRaw(JSON.stringify({ activeKilocalories: 920, calories: 10 }))).toBe(920)
  })
})

describe('extractKcalFromTraining', () => {
  it('prefers externalRaw over notes', () => {
    const r = extractKcalFromTraining({
      notes: '100 kcal',
      externalRaw: JSON.stringify({ calories: 500 }),
      exercise: 'Ride',
    })
    expect(r?.kcal).toBe(500)
    expect(r?.origin).toBe('training')
  })
})

describe('portion micros', () => {
  it('scales micros with portion', () => {
    const scaled = scalePortion(
      {
        kcal: 100,
        proteinG: 10,
        carbsG: 10,
        fatG: 1,
        fiberG: 2,
        assumedGrams: 100,
        packGrams: 100,
        micros: { sodiumMg: 200, ironMg: 1 },
      },
      50,
    )
    expect(scaled.micros?.sodiumMg).toBe(100)
    expect(scaled.micros?.ironMg).toBe(0.5)
    expect(scaled.scale).toBe(0.5)
  })
})

describe('food micros helpers', () => {
  it('infers high_protein tag', () => {
    expect(inferFoodTags({ kcal: 200, proteinG: 30, fiberG: 0, name: 'chicken' })).toContain('high_protein')
  })
  it('sums micros', () => {
    expect(sumMicros([{ sodiumMg: 10 }, { sodiumMg: 5, ironMg: 1 }])).toEqual({ sodiumMg: 15, ironMg: 1 })
  })
  it('soft flags fiber', () => {
    const flags = softNutrientFlags({ fiberG: 10, proteinG: 100, proteinTarget: 160, micros: {} })
    expect(flags.some(f => f.id === 'fiber_low')).toBe(true)
  })
})

describe('bloodwork flags', () => {
  it('flags below / within / above / unknown', () => {
    expect(flagRefRange(2, 3, 5)).toBe('below')
    expect(flagRefRange(4, 3, 5)).toBe('within')
    expect(flagRefRange(6, 3, 5)).toBe('above')
    expect(flagRefRange(4, null, null)).toBe('unknown')
  })
  it('normalizes HbA1c labels', () => {
    expect(normalizeMarkerCode('HbA1c %')).toBe('hba1c')
    expect(normalizeMarkerCode('25-OH Vitamin D')).toBe('vitamin_d')
  })
  it('soft read restates flags', () => {
    const read = softBloodworkRead([
      { code: 'ldl', label: 'LDL', flag: 'above', valueNum: 4, refLow: 0, refHigh: 3 },
      { code: 'hdl', label: 'HDL', flag: 'within', valueNum: 1.2, refLow: 1, refHigh: 2 },
    ])
    expect(read.summary).toContain('Above listed ref: LDL')
    expect(read.disclaimer).toMatch(/not a diagnosis/i)
  })
})
