import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getConnection } from '@/lib/integrations/healthkit/auth'

export async function GET() {
  try {
    const conn = await getConnection()
    const pending = conn
      ? await prisma.pushedWorkout.count({ where: { source: 'healthkit' } })
      : 0

    // Surface whichever error is most recent so the home-screen badge picks it
    // up via its existing `lastError` read. Server-side errors (failed ingest)
    // and client-side errors (companion's background sync failed) are kept
    // separate in the DB for the integrations detail page.
    let derivedError: string | null = null
    let derivedErrorAt: Date | null = null
    if (conn) {
      const serverAt = conn.lastErrorAt?.getTime() ?? 0
      const clientAt = conn.lastClientErrorAt?.getTime() ?? 0
      if (serverAt || clientAt) {
        if (serverAt >= clientAt && conn.lastError) {
          derivedError = conn.lastError
          derivedErrorAt = conn.lastErrorAt
        } else if (conn.lastClientError) {
          derivedError = conn.lastClientError
          derivedErrorAt = conn.lastClientErrorAt
        }
      }
    }

    return NextResponse.json({
      configured: true, // pairing-token model has no env requirement
      connected: Boolean(conn),
      deviceLabel: conn?.deviceLabel ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
      pendingCount: pending,
      lastError: derivedError,
      lastErrorAt: derivedErrorAt,
      lastServerError: conn?.lastError ?? null,
      lastServerErrorAt: conn?.lastErrorAt ?? null,
      lastClientError: conn?.lastClientError ?? null,
      lastClientErrorAt: conn?.lastClientErrorAt ?? null,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
