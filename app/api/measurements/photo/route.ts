import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export const runtime = 'nodejs'

const MAX_BYTES   = 8 * 1024 * 1024 // 8 MB
const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
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
    // jpg + heic both have multiple valid claimed types so we just require any allowed match.
    const ext = sniffedExt

    await mkdir(UPLOAD_DIR, { recursive: true })
    const rand = crypto.randomBytes(6).toString('hex')
    const filename = `${date}-${rand}${ext}`
    await writeFile(path.join(UPLOAD_DIR, filename), buf)

    const photoPath = `/uploads/measurements/${filename}`
    return NextResponse.json({ photoPath, sizeKb: Math.round(buf.length / 1024) })
  } catch (err) {
    console.error('photo upload failed', err)
    return NextResponse.json({ error: 'upload failed' }, { status: 500 })
  }
}
