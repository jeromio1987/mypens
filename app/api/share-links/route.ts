import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE, mintReadOnlySnapshotToken } from '@/lib/auth'

/** Mint a time-limited token for GET /api/public/snapshot (logged-in owners only). */
export async function POST(request: Request) {
  const jar = await cookies()
  const session = jar.get(SESSION_COOKIE)?.value
  if (!(await verifySessionToken(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let ttlHours = 168
  try {
    const body = await request.json()
    if (body && typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours)) {
      ttlHours = body.ttlHours
    }
  } catch {
    // empty body
  }

  const ttlSec = Math.min(90 * 24 * 3600, Math.max(300, Math.round(ttlHours * 3600)))
  const ro = await mintReadOnlySnapshotToken(ttlSec)
  if (!ro) {
    return NextResponse.json(
      { error: 'SESSION_SECRET is not configured; cannot mint share links.' },
      { status: 503 },
    )
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : ''
  const path = `/snapshot?t=${encodeURIComponent(ro)}`
  const shareUrl = origin ? `${origin}${path}` : path

  const parts = ro.split('.')
  const expSec = Number(parts[1])
  const expiresAt = Number.isFinite(expSec) ? new Date(expSec * 1000).toISOString() : null

  return NextResponse.json({ token: ro, shareUrl, expiresAt })
}
