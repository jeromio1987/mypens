import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const configured = Boolean(
      process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET,
    )
    const conn = await prisma.stravaConnection.findUnique({ where: { userId: 'default' } })
    return NextResponse.json({
      configured,
      connected: Boolean(conn),
      athleteId: conn?.athleteId ?? null,
      scope: conn?.scope ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
      expiresAt: conn?.expiresAt ?? null,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
