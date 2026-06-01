import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import * as nodePath from 'node:path'
import { requireOwner } from '@/lib/integrations/requireOwner'
import { sanitiseJournalVoicePath } from '@/lib/journalVoicePath'

export const runtime = 'nodejs'

const MIME: Record<string, string> = {
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
}

/** Authenticated audio file for journal voice (session cookie or mobile Bearer). */
export async function GET(request: Request) {
  const auth = await requireOwner()
  if (auth) return auth

  const raw = new URL(request.url).searchParams.get('path')
  const safe = sanitiseJournalVoicePath(raw)
  if (!safe) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const full = nodePath.join(process.cwd(), 'public', safe)
  try {
    const buf = await readFile(full)
    const ext = safe.split('.').pop()?.toLowerCase() ?? 'webm'
    const ct = MIME[ext] ?? 'application/octet-stream'
    return new NextResponse(buf, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
