import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isIntegrationErrorStale } from '@/lib/integrations/errorTtl'
import { requireOwner } from '@/lib/integrations/requireOwner'

export async function GET() {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    const configured = Boolean(process.env.GARMIN_CLIENT_ID && process.env.GARMIN_CLIENT_SECRET)
    const conn = await prisma.garminConnection.findUnique({ where: { userId: 'default' } })
    const errorStale = isIntegrationErrorStale(conn?.lastErrorAt ?? null)
    return NextResponse.json({
      configured,
      connected: Boolean(conn),
      scope: conn?.scope ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
      expiresAt: conn?.expiresAt ?? null,
      webhookActive: Boolean(conn?.pingSubscribed),
      lastError: errorStale ? null : (conn?.lastError ?? null),
      lastErrorAt: errorStale ? null : (conn?.lastErrorAt ?? null),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
