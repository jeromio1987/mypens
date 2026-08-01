import { NextResponse } from 'next/server'
import type { Model } from '@anthropic-ai/sdk/resources/messages/messages'
import type { BetaImageBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { consume } from '@/lib/rateLimit'
import { BLOODWORK_VISION_SYSTEM_BLOCKS } from '@/lib/bloodworkVisionPrompt'
import { normalizeMarkerCode } from '@/lib/bloodworkFlags'
import { parseJsonFromAssistant } from '@/lib/foodPhotoJson'
import { BLOODWORK_VISION_SCHEMA } from '@/lib/aiSchemas'
import { AiResponseError, callClaude, getAnthropicClient } from '@/lib/aiCall'
import {
  extToMediaType,
  heicToJpeg,
  readPhotoFormFile,
} from '@/lib/photoFormUpload'

export const runtime = 'nodejs'
export const maxDuration = 60

const VISION_MODEL = 'claude-sonnet-4-6' as Model
const FILES_BETA = 'files-api-2025-04-14'

function filenameForExt(ext: string): string {
  if (ext === '.png') return 'lab.png'
  if (ext === '.webp') return 'lab.webp'
  return 'lab.jpg'
}

function toNum(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeDraft(parsed: unknown): {
  drawDate: string | null
  labName: string | null
  fasting: boolean | null
  markers: Array<{
    code: string
    label: string
    valueNum: number | null
    valueText: string | null
    unit: string | null
    refLow: number | null
    refHigh: number | null
  }>
} {
  const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  const drawRaw = typeof root.drawDate === 'string' ? root.drawDate.trim() : ''
  const drawDate = /^\d{4}-\d{2}-\d{2}$/.test(drawRaw) ? drawRaw : null
  const labName =
    typeof root.labName === 'string' && root.labName.trim() ? root.labName.trim().slice(0, 120) : null
  const fasting = typeof root.fasting === 'boolean' ? root.fasting : null
  const rawMarkers = Array.isArray(root.markers) ? root.markers : []
  const markers: Array<{
    code: string
    label: string
    valueNum: number | null
    valueText: string | null
    unit: string | null
    refLow: number | null
    refHigh: number | null
  }> = []
  for (const row of rawMarkers) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const label = typeof r.label === 'string' ? r.label.trim() : ''
    if (!label) continue
    const codeRaw = typeof r.code === 'string' && r.code.trim() ? r.code : label
    markers.push({
      code: normalizeMarkerCode(codeRaw),
      label: label.slice(0, 120),
      valueNum: toNum(r.valueNum),
      valueText: typeof r.valueText === 'string' && r.valueText.trim() ? r.valueText.trim().slice(0, 80) : null,
      unit: typeof r.unit === 'string' && r.unit.trim() ? r.unit.trim().slice(0, 40) : null,
      refLow: toNum(r.refLow),
      refHigh: toNum(r.refHigh),
    })
    if (markers.length >= 40) break
  }
  return { drawDate, labName, fasting, markers }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  try {
    const rl = consume('bloodwork-photo:global', { capacity: 8, refillPerSec: 8 / 3600 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'rate limited — wait a minute and retry' }, { status: 429 })
    }

    const form = await req.formData()
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
          { error: 'could not decode HEIC — export the lab sheet as JPEG/PNG and retry' },
          { status: 422 },
        )
      }
    }

    const mediaType = extToMediaType(ext)
    const client = getAnthropicClient(apiKey)
    const userLine =
      'Extract lab markers from the attached report image. Reply with JSON only (schema in system instructions).'

    const paramsFor = (image: BetaImageBlockParam) => ({
      model: VISION_MODEL,
      max_tokens: 2500,
      betas: [FILES_BETA],
      system: BLOODWORK_VISION_SYSTEM_BLOCKS,
      output_config: {
        format: { type: 'json_schema' as const, schema: BLOODWORK_VISION_SCHEMA },
      },
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: userLine }, image],
        },
      ],
    })

    let text: string
    try {
      const uint8 = new Uint8Array(imageBuf)
      const uploadable = new File([uint8], filenameForExt(ext), { type: mediaType })
      const fileOnAnthropic = await client.beta.files.upload({ file: uploadable, betas: [FILES_BETA] })
      const res = await callClaude(
        client,
        'bloodwork.photo-analyze',
        paramsFor({ type: 'image', source: { type: 'file', file_id: fileOnAnthropic.id } }),
      )
      text = res.text
    } catch (fileErr) {
      if (fileErr instanceof AiResponseError) throw fileErr
      console.error('bloodwork photo Files API path failed, falling back to base64', fileErr)
      const b64 = imageBuf.toString('base64')
      const res = await callClaude(
        client,
        'bloodwork.photo-analyze',
        paramsFor({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } }),
      )
      text = res.text
    }

    const parsed = parseJsonFromAssistant(text)
    const draft = normalizeDraft(parsed)
    return NextResponse.json({
      ...draft,
      disclaimer: 'Draft from photo OCR — review every value before saving. Not medical advice.',
    })
  } catch (err) {
    if (err instanceof AiResponseError) {
      console.error('[bloodwork/photo-analyze]', err.message)
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    const raw = err instanceof Error ? err.message : String(err)
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
    console.error('[bloodwork/photo-analyze]', err)
    return NextResponse.json(
      {
        error:
          detail.length > 0 && detail.length < 280
            ? `Photo analyze failed: ${detail}`
            : 'Photo analyze failed — check API/key and retry',
      },
      { status: 500 },
    )
  }
}
