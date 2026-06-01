import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyReadOnlySnapshotToken } from '@/lib/auth'
import { enrichWeightSeriesFromDb } from '@/lib/enrichWeightSeries'
import { shareTokenDigest } from '@/lib/shareTokenDigest'

/**
 * Public, token-gated JSON snapshot (last 7 enriched weight days).
 * Mint a token via POST /api/share-links while logged in.
 */
export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get('t')
  const { ok, exp } = await verifyReadOnlySnapshotToken(t ?? undefined)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }

  if (t) {
    const digest = shareTokenDigest(t)
    const row = await prisma.shareLink.findUnique({ where: { tokenDigest: digest } })
    if (row) {
      if (row.revokedAt) {
        return NextResponse.json({ error: 'Link revoked' }, { status: 401 })
      }
      if (row.expiresAt.getTime() < Date.now()) {
        return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
      }
    }
    // Rows created before ShareLink existed: HMAC-only verification still passes above.
  }

  try {
    const rawEntries = await prisma.weightEntry.findMany({
      orderBy: { date: 'asc' },
      take: 120,
    })
    const enriched = enrichWeightSeriesFromDb(rawEntries)
    const slice = enriched.slice(-7)
    const weights = slice.map((e) => ({
      date: e.date,
      scaleKg: e.scaleKg,
      trueWeightKg: e.trueWeightKg,
      confidence: e.confidence,
    }))
    const res = NextResponse.json({
      weights,
      generatedAt: new Date().toISOString(),
      expiresAt: exp != null ? new Date(exp * 1000).toISOString() : undefined,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load snapshot' }, { status: 500 })
  }
}
