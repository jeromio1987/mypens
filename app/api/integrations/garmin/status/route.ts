import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const configured = Boolean(process.env.GARMIN_CLIENT_ID && process.env.GARMIN_CLIENT_SECRET)
    const conn = await prisma.garminConnection.findUnique({ where: { userId: 'default' } })
    return NextResponse.json({
      configured,
      connected: Boolean(conn),
      athleteId: conn?.garminUserId ?? null,
      scope: conn?.scope ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
      expiresAt: conn?.expiresAt ?? null,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
