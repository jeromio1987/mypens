/**
 * JSON schemas for Anthropic structured outputs.
 *
 * Constrained decoding guarantees the model returns JSON matching these shapes,
 * which removes the JSON.parse failure mode the vision routes used to have.
 *
 * Anthropic supports only a subset of JSON Schema:
 * - `additionalProperties: false` is mandatory on every object.
 * - Numeric and string-length constraints are dropped, so range checks stay in
 *   lib/foodPhotoJson.ts and the bloodwork normaliser.
 * - Nullable fields use a type union; nullable objects and arrays use `anyOf`.
 *
 * Schemas are compiled and cached server-side for 24h, so keep them stable.
 * Never put personal data in property names, enum values or descriptions.
 */

import { MEAL_ORDER } from '@/lib/foodModels'

export type JsonSchema = Record<string, unknown>

export const FOOD_ANALYSIS_MODES = [
  'meal_estimate',
  'nutrition_label',
  'packaged_product',
] as const

export const FOOD_TAGS = [
  'high_protein',
  'high_fiber',
  'ultra_processed_guess',
  'plant_forward',
  'dairy',
  'contains_alcohol',
] as const

const MICRO_KEYS = [
  'sodiumMg',
  'potassiumMg',
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'vitaminCMg',
  'vitaminDMcg',
  'vitaminB12Mcg',
  'zincMg',
] as const

const microsObject: JsonSchema = {
  type: 'object',
  description: 'Micronutrients for the same portion as the macros. Non-negative.',
  properties: Object.fromEntries(
    MICRO_KEYS.map(k => [k, { type: ['number', 'null'] }]),
  ),
  required: [...MICRO_KEYS],
  additionalProperties: false,
}

const foodItem: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    brand: {
      type: ['string', 'null'],
      description: 'Supermarket or manufacturer when visible, else null.',
    },
    meal: { type: 'string', enum: [...MEAL_ORDER] },
    kcal: { type: 'number', description: 'Non-negative.' },
    proteinG: { type: 'number', description: 'Non-negative grams.' },
    carbsG: { type: 'number', description: 'Non-negative grams.' },
    fatG: { type: 'number', description: 'Non-negative grams.' },
    fiberG: { type: 'number', description: 'Non-negative grams.' },
    packGrams: {
      type: ['number', 'null'],
      description: 'Full net weight of the package in grams when printed, else null.',
    },
    assumedGrams: {
      type: ['number', 'null'],
      description: 'Grams the returned macros apply to. Required whenever macros are above zero.',
    },
    portionGrams: {
      type: ['number', 'null'],
      description: 'Best guess of the amount being logged right now.',
    },
    micros: { anyOf: [{ type: 'null' }, microsObject] },
    tags: {
      anyOf: [
        { type: 'null' },
        { type: 'array', items: { type: 'string', enum: [...FOOD_TAGS] } },
      ],
    },
  },
  required: [
    'name',
    'brand',
    'meal',
    'kcal',
    'proteinG',
    'carbsG',
    'fatG',
    'fiberG',
    'packGrams',
    'assumedGrams',
    'portionGrams',
    'micros',
    'tags',
  ],
  additionalProperties: false,
}

export const FOOD_VISION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    analysisMode: { type: 'string', enum: [...FOOD_ANALYSIS_MODES] },
    dishSummary: { type: 'string', description: 'One short sentence.' },
    items: {
      type: 'array',
      description: 'Up to 12 items. Empty when the image is not food or not readable.',
      items: foodItem,
    },
  },
  required: ['analysisMode', 'dishSummary', 'items'],
  additionalProperties: false,
}

const bloodworkMarker: JsonSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', description: 'Lowercase snake_case slug, e.g. hba1c, ldl, ferritin.' },
    label: { type: 'string', description: 'Short name as printed on the report.' },
    valueNum: { type: ['number', 'null'], description: 'Numeric result, else null.' },
    valueText: {
      type: ['string', 'null'],
      description: 'Qualitative result such as "negative" or "<2", else null.',
    },
    unit: { type: ['string', 'null'] },
    refLow: { type: ['number', 'null'], description: 'Lower reference bound when shown.' },
    refHigh: { type: ['number', 'null'], description: 'Upper reference bound when shown.' },
  },
  required: ['code', 'label', 'valueNum', 'valueText', 'unit', 'refLow', 'refHigh'],
  additionalProperties: false,
}

export const BLOODWORK_VISION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    drawDate: { type: ['string', 'null'], description: 'yyyy-mm-dd when visible, else null.' },
    labName: { type: ['string', 'null'] },
    fasting: { type: ['boolean', 'null'] },
    markers: {
      type: 'array',
      description: 'Up to 40 markers. Empty when the image is not a lab report.',
      items: bloodworkMarker,
    },
  },
  required: ['drawDate', 'labName', 'fasting', 'markers'],
  additionalProperties: false,
}
