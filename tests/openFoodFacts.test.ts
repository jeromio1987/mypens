import { describe, expect, it } from 'vitest'
import { mapOffProduct, parseQuantityToGrams } from '../lib/openFoodFacts'

describe('parseQuantityToGrams', () => {
  it('parses common EU pack labels', () => {
    expect(parseQuantityToGrams('1 kg e')).toBe(1000)
    expect(parseQuantityToGrams('450g')).toBe(450)
    expect(parseQuantityToGrams('450 g')).toBe(450)
    expect(parseQuantityToGrams('1.5kg')).toBe(1500)
  })
})

describe('mapOffProduct', () => {
  it('maps Delhaize-style OFF product to per-100g hit', () => {
    const hit = mapOffProduct({
      code: '5400111111111',
      product_name: '0% Greek Style yoghurt',
      brands: 'Delhaize',
      quantity: '1 kg',
      nutriments: {
        'energy-kcal_100g': 55,
        proteins_100g: 10,
        carbohydrates_100g: 4,
        fat_100g: 0,
        fiber_100g: 0,
      },
    })
    expect(hit).toBeTruthy()
    expect(hit!.brand).toBe('Delhaize')
    expect(hit!.packGrams).toBe(1000)
    expect(hit!.assumedGrams).toBe(100)
    expect(hit!.kcal).toBe(55)
    expect(hit!.name).toMatch(/Delhaize/)
  })
})
