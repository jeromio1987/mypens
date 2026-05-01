import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { consume } from '@/lib/rateLimit'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

export const runtime = 'nodejs'

const MAX_BYTES   = 8 * 1024 * 1024 // 8 MB
const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heic',
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'measurements')

/** Server-side magic-byte sniff. Returns the canonical extension or null. */
function sniffImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return '.png'
  // WebP: "RIFF"....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return '.webp'
  // HEIC / HEIF: bytes 4-7 = "ftyp", brand at 8-11 ∈ {heic, heix, hevc, hevx, mif1, msf1, heim, heis}
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.slice(8, 12).toString('ascii')
    const heicBrands = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'])
    if (heicBrands.has(brand)) return '.heic'
  }
  return null
}

export async function POST(req: Request) {
  try {
    const jar = await cookies()
    const token = jar.get(SESSION_COOKIE)?.value
    if (!(await verifySessionToken(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // — Rate limit: GLOBAL bucket. We deliberately don't key off IP because
    //   x-forwarded-for / x-real-ip are caller-controlled and trivially
    //   spoofable behind no trusted proxy. A single-user app with a global
    //   cap of ~60/hour with a 10-burst is plenty in practice.
    const rl = consume('photo:global', { capacity: 10, refillPerSec: 60 / 3600 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }

    const form = await req.formData()
    const file = form.get('file')
    const date = String(form.get('date') ?? '').trim() || new Date().toISOString().slice(0, 10)

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'empty file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `file too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 })
    }
    const claimedExt = ALLOWED_EXT[file.type]
    if (!claimedExt) {
      return NextResponse.json({ error: `unsupported type: ${file.type}` }, { status: 415 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be yyyy-mm-dd' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    // Defend against MIME spoofing — trust the bytes, not the client header.
    const sniffedExt = sniffImageExt(buf)
    if (!sniffedExt) {
      return NextResponse.json({ error: 'file is not a recognised image (jpg/png/webp/heic)' }, { status: 415 })
    }

    let finalBuf: Buffer = buf
    let finalExt: string  = sniffedExt

    // HEIC → JPEG conversion. Browsers cannot render HEIC natively,
    // so we transcode at upload time to keep the photo strip + viewer working.
    if (sniffedExt === '.heic') {
      try {
        const heicConvert = (await import('heic-convert')).default
        const out = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 })
        finalBuf = Buffer.from(out)
        finalExt = '.jpg'
      } catch (err) {
        console.error('HEIC conversion failed', err)
        return NextResponse.json({ error: 'could not decode HEIC image' }, { status: 422 })
      }
    }

    await mkdir(UPLOAD_DIR, { recursive: true })
    const rand = crypto.randomBytes(6).toString('hex')
    const filename = `${date}-${rand}${finalExt}`
    await writeFile(path.join(UPLOAD_DIR, filename), finalBuf)

    const photoPath = `/uploads/measurements/${filename}`
    return NextResponse.json({ photoPath, sizeKb: Math.round(finalBuf.length / 1024) })
  } catch (err) {
    console.error('photo upload failed', err)
    return NextResponse.json({ error: 'upload failed' }, { status: 500 })
  }
}
