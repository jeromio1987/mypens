import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncSleep } from '@/lib/integrations/garmin/sleepSync'
import { requireOwner } from '@/lib/integrations/requireOwner'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    const conn = await prisma.garminConnection.findUnique({ where: { userId: 'default' } })
    if (!conn) {
      return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 })
    }
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') || 30)))
    const result = await syncSleep(days)
    return NextResponse.json({ ok: true, ...result, days })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
