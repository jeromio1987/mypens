import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Model } from '@anthropic-ai/sdk/resources/messages/messages'
import { consume } from '@/lib/rateLimit'
import { BLOODWORK_VISION_SYSTEM_BLOCKS } from '@/lib/bloodworkVisionPrompt'
import { normalizeMarkerCode } from '@/lib/bloodworkFlags'
import { parseJsonFromAssistant } from '@/lib/foodPhotoJson'

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
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }

    const form = await req.formData()
    const file = form.get('file')

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
    const client = new Anthropic({ apiKey })
    const userLine =
      'Extract lab markers from the attached report image. Reply with JSON only (schema in system instructions).'

    let text: string
    try {
      const uint8 = new Uint8Array(imageBuf)
      const uploadable = new File([uint8], filenameForExt(ext), { type: mediaType })
      const uploaded = await client.beta.files.upload({ file: uploadable, betas: [FILES_BETA] })
      const msg = await client.beta.messages.create({
        model: VISION_MODEL,
        max_tokens: 2500,
        betas: [FILES_BETA],
        system: BLOODWORK_VISION_SYSTEM_BLOCKS,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: userLine },
              { type: 'image', source: { type: 'file', file_id: uploaded.id } },
            ],
          },
        ],
      })
      text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
    } catch (fileErr) {
      console.error('bloodwork photo Files API path failed, falling back to base64', fileErr)
      const b64 = imageBuf.toString('base64')
      const msg = await client.beta.messages.create({
        model: VISION_MODEL,
        max_tokens: 2500,
        betas: [FILES_BETA],
        system: BLOODWORK_VISION_SYSTEM_BLOCKS,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: userLine },
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            ],
          },
        ],
      })
      text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
    }

    const parsed = parseJsonFromAssistant(text)
    const draft = normalizeDraft(parsed)
    return NextResponse.json({
      ...draft,
      disclaimer: 'Draft from photo OCR — review every value before saving. Not medical advice.',
    })
  } catch (err) {
    console.error('[bloodwork/photo-analyze]', err)
    return NextResponse.json({ error: 'Photo analyze failed' }, { status: 500 })
  }
}
