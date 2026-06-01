import { NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { consume } from '@/lib/rateLimit'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sanitiseJournalVoicePath } from '@/lib/journalVoicePath'

export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXT: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/wav': '.wav',
  'audio/wave': '.wav',
  'audio/x-wav': '.wav',
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'journal')

function sniffAudioExt(buf: Buffer): string | null {
  if (buf.length < 12) return null
  // RIFF....WAVE
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) {
    return '.wav'
  }
  // OggS
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return '.ogg'
  // WebM / EBML (1a 45 df a3)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return '.webm'
  // ISO BMFF (ftyp)
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return '.m4a'
  return null
}

async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/** Multipart voice upload → `/uploads/journal/…` */
export async function POST(req: Request) {
  try {
    const auth = await requireSession()
    if (auth) return auth

    const rl = consume('journal-voice:global', { capacity: 8, refillPerSec: 20 / 3600 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }

    const form = await req.formData()
    const file = form.get('file')
    const date = String(form.get('date') ?? '').trim() || new Date().toISOString().slice(0, 10)

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'empty or too large (max 5 MB)' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be yyyy-mm-dd' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const claimedExt = ALLOWED_EXT[file.type]
    const sniffed = sniffAudioExt(buf)
    const ext = sniffed ?? claimedExt
    if (!ext) {
      return NextResponse.json({ error: 'unsupported or unrecognised audio' }, { status: 415 })
    }

    await mkdir(UPLOAD_DIR, { recursive: true })
    const rand = crypto.randomBytes(6).toString('hex')
    const filename = `${date}-${rand}${ext}`
    await writeFile(path.join(UPLOAD_DIR, filename), buf)

    const voicePath = `/uploads/journal/${filename}`
    return NextResponse.json({ voicePath, sizeKb: Math.round(buf.length / 1024) })
  } catch (err) {
    console.error('journal voice upload failed', err)
    return NextResponse.json({ error: 'upload failed' }, { status: 500 })
  }
}

/** Remove stored file and clear `voicePath` on the journal row for `date`. */
export async function DELETE(req: Request) {
  try {
    const auth = await requireSession()
    if (auth) return auth

    const date = new URL(req.url).searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date query (yyyy-mm-dd) required' }, { status: 400 })
    }

    const entry = await prisma.journalEntry.findUnique({ where: { date } })
    if (!entry?.voicePath) {
      return NextResponse.json({ ok: true })
    }

    const safe = sanitiseJournalVoicePath(entry.voicePath)
    if (safe) {
      const full = path.join(process.cwd(), 'public', safe)
      try {
        await unlink(full)
      } catch {
        // non-fatal
      }
    }

    await prisma.journalEntry.update({
      where: { date },
      data: { voicePath: null, voiceDurationSec: null },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('journal voice delete failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
