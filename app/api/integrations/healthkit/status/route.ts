import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getConnection } from '@/lib/integrations/healthkit/auth'

export async function GET() {
  try {
    const conn = await getConnection()
    const pending = conn
      ? await prisma.pushedWorkout.count({ where: { source: 'healthkit' } })
      : 0
    return NextResponse.json({
      configured: true, // pairing-token model has no env requirement
      connected: Boolean(conn),
      deviceLabel: conn?.deviceLabel ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
      pendingCount: pending,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
