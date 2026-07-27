import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  BLOODWORK_VISION_SCHEMA,
  FOOD_VISION_SCHEMA,
  type JsonSchema,
} from '../../lib/aiSchemas'
import { findSchemaIncompatibilities, validateAgainstSchema } from '../../lib/jsonSchemaCheck'
import { extractVisionPayload } from '../../lib/foodPhotoJson'

const FIXTURES = join(__dirname, 'fixtures')

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'))
}

async function weeklySchema(): Promise<JsonSchema> {
  const mod = (await import('../../scripts/lib/aiSchemas.mjs')) as {
    WEEKLY_FEEDBACK_SCHEMA: JsonSchema
  }
  return mod.WEEKLY_FEEDBACK_SCHEMA
}

describe('schemas are safe to send to Anthropic', () => {
  it('food vision schema uses only the supported subset', () => {
    expect(findSchemaIncompatibilities(FOOD_VISION_SCHEMA)).toEqual([])
  })

  it('bloodwork schema uses only the supported subset', () => {
    expect(findSchemaIncompatibilities(BLOODWORK_VISION_SCHEMA)).toEqual([])
  })

  it('weekly feedback schema uses only the supported subset', async () => {
    expect(findSchemaIncompatibilities(await weeklySchema())).toEqual([])
  })
})

describe('golden fixtures conform to their schema', () => {
  it('nutrition label response', () => {
    expect(validateAgainstSchema(fixture('food-label'), FOOD_VISION_SCHEMA)).toEqual([])
  })

  it('meal estimate response', () => {
    expect(validateAgainstSchema(fixture('food-meal'), FOOD_VISION_SCHEMA)).toEqual([])
  })

  it('bloodwork panel response', () => {
    expect(validateAgainstSchema(fixture('bloodwork-panel'), BLOODWORK_VISION_SCHEMA)).toEqual([])
  })

  it('weekly feedback response', async () => {
    expect(validateAgainstSchema(fixture('weekly-feedback'), await weeklySchema())).toEqual([])
  })
})

describe('the validator actually rejects bad output', () => {
  it('catches a wrong enum value', () => {
    const bad = { ...(fixture('food-label') as Record<string, unknown>), analysisMode: 'guessing' }
    expect(validateAgainstSchema(bad, FOOD_VISION_SCHEMA)).not.toEqual([])
  })

  it('catches a missing required field', () => {
    const bad = fixture('food-meal') as { items: Record<string, unknown>[] }
    delete bad.items[0].assumedGrams
    expect(validateAgainstSchema(bad, FOOD_VISION_SCHEMA)).not.toEqual([])
  })

  it('catches an unexpected extra field', () => {
    const bad = fixture('bloodwork-panel') as Record<string, unknown>
    bad.diagnosis = 'not allowed'
    expect(validateAgainstSchema(bad, BLOODWORK_VISION_SCHEMA)).not.toEqual([])
  })
})

describe('normalisers hold their output on the golden set', () => {
  it('keeps brand, pack size and portion from a label scan', () => {
    const { analysisMode, dishSummary, items } = extractVisionPayload(fixture('food-label'), 'snack')
    expect(analysisMode).toBe('nutrition_label')
    expect(dishSummary).toContain('Greek yoghurt')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      name: 'Delhaize 0% Greek yoghurt',
      brand: 'Delhaize',
      meal: 'breakfast',
      kcal: 57,
      packGrams: 1000,
      assumedGrams: 100,
      portionGrams: 200,
    })
    expect(items[0].micros).toMatchObject({ calciumMg: 110, sodiumMg: 41 })
    expect(items[0].tags).toEqual(['high_protein', 'dairy'])
  })

  it('splits a plate into three items and drops null micros', () => {
    const { analysisMode, items } = extractVisionPayload(fixture('food-meal'), 'snack')
    expect(analysisMode).toBe('meal_estimate')
    expect(items.map(i => i.name)).toEqual([
      'Grilled chicken breast',
      'White rice, cooked',
      'Steamed broccoli',
    ])
    expect(items.every(i => i.meal === 'dinner')).toBe(true)
    expect(items[0].micros).toBeNull()
    expect(items[1].tags).toBeNull()
  })

  it('falls back to the default meal when the model omits one', () => {
    const raw = fixture('food-meal') as { items: Record<string, unknown>[] }
    delete raw.items[0].meal
    const { items } = extractVisionPayload(raw, 'lunch')
    expect(items[0].meal).toBe('lunch')
  })
})
