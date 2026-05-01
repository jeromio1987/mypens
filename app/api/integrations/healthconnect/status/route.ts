import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getConnection } from '@/lib/integrations/healthconnect/auth'
import { getMobileStaleThresholdHours } from '@/lib/integrations/staleThreshold'
import { isIntegrationErrorStale } from '@/lib/integrations/errorTtl'
import { requireOwner } from '@/lib/integrations/requireOwner'

export async function GET() {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    const conn = await getConnection()
    const pending = conn
      ? await prisma.pushedWorkout.count({ where: { source: 'healthconnect' } })
      : 0

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
    // Suppress stale errors from the badge view — the raw fields below stay
    // intact so the integrations detail page can still show history.
    if (isIntegrationErrorStale(derivedErrorAt)) {
      derivedError = null
      derivedErrorAt = null
    }

    const staleThresholdHours = getMobileStaleThresholdHours()
    const lastIngestAt = conn?.lastSyncAt ?? null
    const hoursSinceLastIngest = lastIngestAt
      ? (Date.now() - lastIngestAt.getTime()) / 3_600_000
      : null
    // For a never-ingested pairing, fall back to the connection's age so a
    // freshly issued/rotated token doesn't immediately flash the warning.
    const hoursSincePaired = conn
      ? (Date.now() - conn.createdAt.getTime()) / 3_600_000
      : null
    const stale =
      conn != null &&
      (hoursSinceLastIngest != null
        ? hoursSinceLastIngest > staleThresholdHours
        : (hoursSincePaired ?? 0) > staleThresholdHours)

    return NextResponse.json({
      configured: true,
      connected: Boolean(conn),
      deviceLabel: conn?.deviceLabel ?? null,
      lastSyncAt: lastIngestAt,
      lastIngestAt,
      hoursSinceLastIngest,
      staleThresholdHours,
      stale,
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
