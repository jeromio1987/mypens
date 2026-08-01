import { NextResponse } from 'next/server'
import type { Model } from '@anthropic-ai/sdk/resources/messages/messages'
import type { BetaImageBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { consume } from '@/lib/rateLimit'
import { MEAL_ORDER, type MealType } from '@/lib/foodModels'
import { FOOD_VISION_SYSTEM_BLOCKS } from '@/lib/foodVisionPrompt'
import { extractVisionPayload, parseJsonFromAssistant } from '@/lib/foodPhotoJson'
import { FOOD_VISION_SCHEMA } from '@/lib/aiSchemas'
import { AiResponseError, callClaude, getAnthropicClient } from '@/lib/aiCall'
import { today } from '@/lib/timeWindow'
import {
  extToMediaType,
  heicToJpeg,
  readPhotoFormFile,
} from '@/lib/photoFormUpload'

export const runtime = 'nodejs'
/** Vision + Files API routinely exceeds the default serverless budget. */
export const maxDuration = 60

const VISION_MODEL = 'claude-sonnet-4-6' as Model
const FILES_BETA = 'files-api-2025-04-14'

function filenameForExt(ext: string): string {
  if (ext === '.png') return 'food.png'
  if (ext === '.webp') return 'food.webp'
  return 'food.jpg'
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  try {
    const rl = consume('food-photo:global', { capacity: 12, refillPerSec: 12 / 3600 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'rate limited — wait a minute and retry' }, { status: 429 })
    }

    const form = await req.formData()
    const date = String(form.get('date') ?? '').trim() || today()
    const mealHint = String(form.get('meal') ?? 'snack').trim()
    const defaultMeal: MealType = typeof mealHint === 'string' && (MEAL_ORDER as readonly string[]).includes(mealHint)
      ? (mealHint as MealType)
      : 'snack'

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be yyyy-mm-dd' }, { status: 400 })
    }

    const uploaded = await readPhotoFormFile(form.get('file'))
    if (!uploaded.ok) {
      return NextResponse.json({ error: uploaded.error }, { status: uploaded.status })
    }

    let imageBuf = uploaded.buf
    let ext = uploaded.ext
    if (ext === '.heic') {
      try {
        imageBuf = await heicToJpeg(uploaded.buf)
        ext = '.jpg'
      } catch {
        return NextResponse.json(
          { error: 'could not decode HEIC — re-save as JPEG in the Photos app, or take a new camera photo' },
          { status: 422 },
        )
      }
    }

    const mediaType = extToMediaType(ext)
    const client = getAnthropicClient(apiKey)

    const userLine =
      `Diary date: ${date}. Default meal when an item omits meal: ${defaultMeal}.\n` +
      'Analyze the attached image and reply with JSON only (schema in system instructions).'

    const paramsFor = (image: BetaImageBlockParam) => ({
      model: VISION_MODEL,
      max_tokens: 1400,
      betas: [FILES_BETA],
      system: FOOD_VISION_SYSTEM_BLOCKS,
      output_config: {
        format: { type: 'json_schema' as const, schema: FOOD_VISION_SCHEMA },
      },
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: userLine }, image],
        },
      ],
    })

    let anthropicFileId: string | null = null
    let text: string

    try {
      const uint8 = new Uint8Array(imageBuf)
      const uploadable = new File([uint8], filenameForExt(ext), { type: mediaType })
      const fileOnAnthropic = await client.beta.files.upload({ file: uploadable, betas: [FILES_BETA] })
      anthropicFileId = fileOnAnthropic.id

      const res = await callClaude(
        client,
        'food.photo-analyze',
        paramsFor({ type: 'image', source: { type: 'file', file_id: fileOnAnthropic.id } }),
      )
      text = res.text
    } catch (fileErr) {
      if (fileErr instanceof AiResponseError) throw fileErr
      console.error('food photo Files API path failed, falling back to base64', fileErr)
      anthropicFileId = null
      const b64 = imageBuf.toString('base64')
      const res = await callClaude(
        client,
        'food.photo-analyze',
        paramsFor({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } }),
      )
      text = res.text
    }

    if (!text) {
      return NextResponse.json({ error: 'empty model response — retry the photo' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = parseJsonFromAssistant(text)
    } catch {
      return NextResponse.json({ error: 'could not parse nutrition JSON — retry or log manually' }, { status: 502 })
    }

    const { analysisMode, dishSummary, items } = extractVisionPayload(parsed, defaultMeal)

    return NextResponse.json({ analysisMode, dishSummary, items, anthropicFileId })
  } catch (err) {
    if (err instanceof AiResponseError) {
      console.error('food photo-analyze', err.message)
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    const raw = err instanceof Error ? err.message : String(err)
    // Surface Anthropic/API detail to the phone Alert — never opaque "analysis failed".
    let detail = raw
    try {
      const m = raw.match(/\{[\s\S]*\}$/)
      if (m) {
        const j = JSON.parse(m[0]) as { error?: { message?: string } }
        if (j?.error?.message) detail = j.error.message
      }
    } catch {
      /* keep raw */
    }
    console.error('food photo-analyze', err)
    return NextResponse.json(
      {
        error:
          detail.length > 0 && detail.length < 280
            ? `Photo analysis failed: ${detail}`
            : 'analysis failed — check Next is up and ANTHROPIC_API_KEY, then retry',
      },
      { status: 500 },
    )
  }
}
