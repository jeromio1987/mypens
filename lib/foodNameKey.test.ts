import { describe, expect, it } from 'vitest'
import { foodNameKey } from '@/lib/foodNameKey'

describe('foodNameKey', () => {
  it('collapses same product with different grams', () => {
    expect(foodNameKey('Skyr nature 150g')).toBe(foodNameKey('Skyr nature 200g'))
    expect(foodNameKey('Skyr nature (150g)')).toBe(foodNameKey('Skyr nature'))
    expect(foodNameKey('Yoghurt 150 g')).toBe(foodNameKey('Yoghurt 100g'))
  })

  it('keeps different products distinct', () => {
    expect(foodNameKey('Skyr nature')).not.toBe(foodNameKey('Skyr vanille'))
  })
})
