/**
 * Live golden-set eval. Costs money and needs a network, so it only runs via
 * `npm run eval:ai` (which sets RUN_AI_EVALS=1 and loads .env). Run it before
 * shipping a prompt or schema change; the offline suite in schemas.test.ts is
 * what runs on every `npm test`.
 *
 * Drop real photos into tests/ai/fixtures/images/ to extend the vision half.
 * Nothing is committed there by default, and the image tests skip when it is
 * empty rather than inventing a fixture.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'

import { FOOD_VISION_SCHEMA, type JsonSchema } from '../../lib/aiSchemas'
import { validateAgainstSchema } from '../../lib/jsonSchemaCheck'
import { FOOD_VISION_SYSTEM_BLOCKS } from '../../lib/foodVisionPrompt'
import { extractVisionPayload } from '../../lib/foodPhotoJson'

const LIVE = process.env.RUN_AI_EVALS === '1' && Boolean(process.env.ANTHROPIC_API_KEY?.trim())
const MODEL = 'claude-sonnet-4-6'
const FILES_BETA = 'files-api-2025-04-14'
const IMAGE_DIR = join(__dirname, 'fixtures', 'images')
const MEDIA_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim(), maxRetries: 4 })
}

function imageFixtures(): string[] {
  if (!existsSync(IMAGE_DIR)) return []
  return readdirSync(IMAGE_DIR)
    .filter(f => MEDIA_TYPES[extname(f).toLowerCase()])
    .map(f => join(IMAGE_DIR, f))
}

async function weeklySchema(): Promise<JsonSchema> {
  const mod = (await import('../../scripts/lib/aiSchemas.mjs')) as {
    WEEKLY_FEEDBACK_SCHEMA: JsonSchema
  }
  return mod.WEEKLY_FEEDBACK_SCHEMA
}

/** Fixed input so a schema or prompt change is the only moving part. */
const WEEKLY_METRICS = {
  weekOf: '2026-03-09',
  weekEnd: '2026-03-15',
  sleep: { nights: 7, avgHours: 7.3, avgQuality: 3.8, nightsUnder6h5: 0 },
  weight: { entries: 7, avgTrueKg: 84.1, trend: 'flat', deltaKg: 0.05 },
  training: { sessions: 2, totalVolumeKg: 8400 },
  food: { daysLogged: 5, avgKcalPerDay: 2150, avgProteinPerDay: 165 },
  work: { sessions: 18, promptCount: 142, avgPromptChars: 380, lateNightPromptCount: 9 },
}

describe.skipIf(!LIVE)('live structured output contract', () => {
  it(
    'returns weekly feedback that matches the schema',
    async () => {
      const schema = await weeklySchema()
      const msg = await client().beta.messages.create({
        model: MODEL,
        max_tokens: 1400,
        system:
          'You are MY PENS Weekly Feedback. Direct, analytical, no platitudes, no em-dashes. ' +
          'Use only the numbers given. Three sections plus wins, improvements, health actions and ISZE actions.',
        output_format: { type: 'json_schema', schema },
        messages: [
          {
            role: 'user',
            content: `Week data (JSON):\n${JSON.stringify(WEEKLY_METRICS)}\n\nWrite the review.`,
          },
        ],
      })

      expect(msg.stop_reason).not.toBe('max_tokens')
      expect(msg.stop_reason).not.toBe('refusal')

      const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
      const parsed = JSON.parse(text)
      expect(validateAgainstSchema(parsed, schema)).toEqual([])
      expect(parsed.combinedSummary.length).toBeGreaterThan(40)
    },
    120_000,
  )

  const images = imageFixtures()

  it.skipIf(images.length === 0)(
    'returns food analysis that matches the schema for every image fixture',
    async () => {
      const anthropic = client()
      for (const path of images) {
        const data = readFileSync(path).toString('base64')
        const msg = await anthropic.beta.messages.create({
          model: MODEL,
          max_tokens: 1400,
          betas: [FILES_BETA],
          system: FOOD_VISION_SYSTEM_BLOCKS,
          output_format: { type: 'json_schema', schema: FOOD_VISION_SCHEMA },
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Diary date: 2026-03-09. Default meal when an item omits meal: snack.',
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: MEDIA_TYPES[extname(path).toLowerCase()],
                    data,
                  },
                },
              ],
            },
          ],
        })

        const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
        const parsed = JSON.parse(text)

        expect(
          validateAgainstSchema(parsed, FOOD_VISION_SCHEMA),
          `schema violations for ${path}`,
        ).toEqual([])

        // The normaliser must survive whatever the model returned.
        const payload = extractVisionPayload(parsed, 'snack')
        for (const item of payload.items) {
          expect(item.kcal).toBeGreaterThanOrEqual(0)
          expect(item.proteinG).toBeGreaterThanOrEqual(0)
        }
      }
    },
    300_000,
  )
})
