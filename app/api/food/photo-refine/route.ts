import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Model } from '@anthropic-ai/sdk/resources/messages/messages'
import { consume } from '@/lib/rateLimit'
import { MEAL_ORDER, type MealType } from '@/lib/foodModels'
import { FOOD_VISION_SYSTEM_BLOCKS } from '@/lib/foodVisionPrompt'
import { extractVisionPayload, parseJsonFromAssistant } from '@/lib/foodPhotoJson'

export const runtime = 'nodejs'

const VISION_MODEL = 'claude-sonnet-4-6' as Model
const FILES_BETA = 'files-api-2025-04-14'

interface RefineBody {
  anthropicFileId?: string
  date?: string
  meal?: string
  priorAssistantText?: string
  refine?: string
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  try {
    const rl = consume('food-photo-refine', { capacity: 20, refillPerSec: 20 / 3600 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }

    const body = (await req.json()) as RefineBody
    const anthropicFileId = String(body.anthropicFileId ?? '').trim()
    const date = String(body.date ?? '').trim() || new Date().toISOString().slice(0, 10)
    const mealHint = String(body.meal ?? 'snack').trim()
    const priorAssistantText = String(body.priorAssistantText ?? '').trim()
    const refine = String(body.refine ?? '').trim()

    const defaultMeal: MealType = typeof mealHint === 'string' && (MEAL_ORDER as readonly string[]).includes(mealHint)
      ? (mealHint as MealType)
      : 'snack'

    if (!anthropicFileId) {
      return NextResponse.json({ error: 'anthropicFileId is required (from the first photo scan response)' }, { status: 400 })
    }
    if (!priorAssistantText) {
      return NextResponse.json({ error: 'priorAssistantText is required (raw JSON string from the first scan)' }, { status: 400 })
    }
    if (!refine) {
      return NextResponse.json({ error: 'refine is required' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be yyyy-mm-dd' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    const userLine =
      `Diary date: ${date}. Default meal when an item omits meal: ${defaultMeal}.\n` +
      'Analyze the attached image and reply with JSON only (schema in system instructions).'

    const msg = await client.beta.messages.create({
      model: VISION_MODEL,
      max_tokens: 1400,
      betas: [FILES_BETA],
      system: FOOD_VISION_SYSTEM_BLOCKS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userLine },
            { type: 'image', source: { type: 'file', file_id: anthropicFileId } },
          ],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: priorAssistantText }],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `User correction: ${refine}\n` +
                'Output the complete revised JSON only (same schema: analysisMode, dishSummary, items).',
            },
          ],
        },
      ],
    })

    const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) {
      return NextResponse.json({ error: 'empty model response' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = parseJsonFromAssistant(text)
    } catch {
      return NextResponse.json({ error: 'could not parse nutrition JSON' }, { status: 502 })
    }

    const { analysisMode, dishSummary, items } = extractVisionPayload(parsed, defaultMeal)

    return NextResponse.json({ analysisMode, dishSummary, items, anthropicFileId })
  } catch (err) {
    console.error('food photo-refine', err)
    return NextResponse.json({ error: 'refine failed' }, { status: 500 })
  }
}
