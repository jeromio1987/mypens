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

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heic',
}

const VISION_MODEL = 'claude-sonnet-4-6' as Model
const FILES_BETA = 'files-api-2025-04-14'

function sniffImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg'
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return '.png'
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return '.webp'
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.slice(8, 12).toString('ascii')
    const heicBrands = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'])
    if (heicBrands.has(brand)) return '.heic'
  }
  return null
}

function extToMediaType(ext: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}

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
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }

    const form = await req.formData()
    const file = form.get('file')
    const date = String(form.get('date') ?? '').trim() || today()
    const mealHint = String(form.get('meal') ?? 'snack').trim()
    const defaultMeal: MealType = typeof mealHint === 'string' && (MEAL_ORDER as readonly string[]).includes(mealHint)
      ? (mealHint as MealType)
      : 'snack'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'empty file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `file too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 })
    }
    if (!ALLOWED_EXT[file.type]) {
      return NextResponse.json({ error: `unsupported type: ${file.type}` }, { status: 415 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be yyyy-mm-dd' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const sniffed = sniffImageExt(buf)
    if (!sniffed) {
      return NextResponse.json({ error: 'file is not a recognised image' }, { status: 415 })
    }

    let imageBuf = buf
    let ext = sniffed
    if (sniffed === '.heic') {
      try {
        const heicConvert = (await import('heic-convert')).default
        const out = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 })
        imageBuf = Buffer.from(out)
        ext = '.jpg'
      } catch {
        return NextResponse.json({ error: 'could not decode HEIC image' }, { status: 422 })
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
      const uploaded = await client.beta.files.upload({ file: uploadable, betas: [FILES_BETA] })
      anthropicFileId = uploaded.id

      const res = await callClaude(
        client,
        'food.photo-analyze',
        paramsFor({ type: 'image', source: { type: 'file', file_id: uploaded.id } }),
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
    if (err instanceof AiResponseError) {
      console.error('food photo-analyze', err.message)
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    console.error('food photo-analyze', err)
    return NextResponse.json({ error: 'analysis failed' }, { status: 500 })
  }
}
