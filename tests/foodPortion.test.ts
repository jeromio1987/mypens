import { describe, expect, it } from 'vitest'
import { defaultEatenGrams, scalePortion } from '../lib/foodPortion'
import { extractVisionPayload, normalizeItems } from '../lib/foodPhotoJson'

describe('scalePortion', () => {
  it('scales a 1kg yoghurt down to 200g', () => {
    const base = {
      kcal: 550,
      proteinG: 100,
      carbsG: 40,
      fatG: 0,
      fiberG: 0,
      assumedGrams: 1000,
      packGrams: 1000,
      brand: 'Delhaize',
    }
    const scaled = scalePortion(base, 200)
    expect(scaled.kcal).toBe(110)
    expect(scaled.proteinG).toBe(20)
    expect(scaled.scale).toBe(0.2)
  })

  it('leaves macros unchanged when assumedGrams missing', () => {
    const base = {
      kcal: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
      fiberG: 1,
      assumedGrams: null,
      packGrams: null,
    }
    const scaled = scalePortion(base, 50)
    expect(scaled.kcal).toBe(200)
  })
})

describe('normalizeItems packaged fields', () => {
  it('keeps brand + packGrams from vision JSON', () => {
    const items = normalizeItems(
      {
        items: [
          {
            name: 'Delhaize 0% Greek yoghurt',
            brand: 'Delhaize',
            meal: 'breakfast',
            kcal: 550,
            proteinG: 100,
            carbsG: 40,
            fatG: 0,
            fiberG: 0,
            packGrams: 1000,
            assumedGrams: 1000,
            portionGrams: 1000,
          },
        ],
      },
      'snack',
    )
    expect(items[0].brand).toBe('Delhaize')
    expect(items[0].packGrams).toBe(1000)
    expect(defaultEatenGrams(items[0])).toBe(1000)
  })

  it('extracts packaged_product mode', () => {
    const p = extractVisionPayload(
      { analysisMode: 'packaged_product', dishSummary: 'ok', items: [] },
      'lunch',
    )
    expect(p.analysisMode).toBe('packaged_product')
  })
})
