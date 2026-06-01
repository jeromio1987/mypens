import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE, mintReadOnlySnapshotToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { shareTokenDigest } from '@/lib/shareTokenDigest'

async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies()
  const session = jar.get(SESSION_COOKIE)?.value
  if (!(await verifySessionToken(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/** List minted share links (active + revoked metadata). */
export async function GET() {
  const auth = await requireSession()
  if (auth) return auth
  try {
    const links = await prisma.shareLink.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    })
    return NextResponse.json({ links })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to list' }, { status: 500 })
  }
}

/** Mint a time-limited token for GET /api/public/snapshot (logged-in owners only). */
export async function POST(request: Request) {
  const auth = await requireSession()
  if (auth) return auth

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

  const parts = ro.split('.')
  const expSec = Number(parts[1])
  const expiresAt = Number.isFinite(expSec) ? new Date(expSec * 1000) : new Date(Date.now() + ttlSec * 1000)

  try {
    await prisma.shareLink.create({
      data: {
        tokenDigest: shareTokenDigest(ro),
        expiresAt,
      },
    })
  } catch (e) {
    console.error('share link persist failed', e)
    return NextResponse.json({ error: 'Could not persist share link' }, { status: 500 })
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : ''
  const path = `/snapshot?t=${encodeURIComponent(ro)}`
  const shareUrl = origin ? `${origin}${path}` : path

  return NextResponse.json({
    token: ro,
    shareUrl,
    expiresAt: expiresAt.toISOString(),
  })
}

/** Revoke a share link by row id (?id=). */
export async function DELETE(request: Request) {
  const auth = await requireSession()
  if (auth) return auth

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id query parameter required' }, { status: 400 })
  }

  try {
    await prisma.shareLink.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to revoke' }, { status: 500 })
  }
}
