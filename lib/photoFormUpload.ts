/**
 * Shared helpers for food / bloodwork photo-analyze uploads.
 * Declared MIME from mobile clients is often empty or wrong — sniff bytes first.
 */

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024

const DECLARED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heic',
  'application/octet-stream': '', // defer to sniff
  '': '',
}

export function sniffImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg'
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return '.png'
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return '.webp'
  }
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.slice(8, 12).toString('ascii')
    const heicBrands = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'])
    if (heicBrands.has(brand)) return '.heic'
  }
  return null
}

export function extToMediaType(ext: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}

export type PhotoFileOk =
  | { ok: true; buf: Buffer; ext: string; declaredType: string }
  | { ok: false; status: number; error: string }

/**
 * Accept multipart `file` even when Content-Type is missing/wrong (common on Android).
 * Reject only when bytes are not a recognised image or size limits fail.
 */
export async function readPhotoFormFile(file: FormDataEntryValue | null): Promise<PhotoFileOk> {
  if (file == null || typeof file === 'string') {
    return { ok: false, status: 400, error: 'file is required' }
  }
  // Next/undici: File; some runtimes may hand a Blob
  const blob = file as Blob
  if (typeof blob.arrayBuffer !== 'function') {
    return { ok: false, status: 400, error: 'file is required' }
  }
  const size = typeof blob.size === 'number' ? blob.size : 0
  if (size <= 0) {
    return { ok: false, status: 400, error: 'empty file' }
  }
  if (size > PHOTO_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `file too large (max ${PHOTO_MAX_BYTES / 1024 / 1024} MB)`,
    }
  }

  const declaredType = (typeof (blob as File).type === 'string' ? (blob as File).type : '')
    .trim()
    .toLowerCase()
  if (declaredType && !(declaredType in DECLARED_MIME) && !declaredType.startsWith('image/')) {
    return {
      ok: false,
      status: 415,
      error: `unsupported type: ${declaredType || '(empty)'} — use JPEG/PNG/WebP/HEIC`,
    }
  }

  const buf = Buffer.from(await blob.arrayBuffer())
  const sniffed = sniffImageExt(buf)
  if (!sniffed) {
    return {
      ok: false,
      status: 415,
      error:
        'file is not a recognised image (JPEG/PNG/WebP/HEIC). Re-take as a normal camera photo, not a screenshot export.',
    }
  }

  // Declared HEIC but sniff disagrees → trust sniff
  if (declaredType && DECLARED_MIME[declaredType] && DECLARED_MIME[declaredType] !== sniffed) {
    // e.g. client said image/jpeg but bytes are HEIC — sniff wins
  }

  return { ok: true, buf, ext: sniffed, declaredType }
}

export async function heicToJpeg(buf: Buffer): Promise<Buffer> {
  const heicConvert = (await import('heic-convert')).default
  const out = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 })
  return Buffer.from(out)
}
