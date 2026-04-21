import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteSubscription } from '@/lib/integrations/strava/webhook'

export async function POST() {
  try {
    const conn = await prisma.stravaConnection.findUnique({ where: { userId: 'default' } })
    if (conn?.webhookId) {
      // Best-effort: tear down the app's webhook subscription so Strava stops
      // calling us. Don't block disconnect if this fails.
      try {
        await deleteSubscription(conn.webhookId)
      } catch (err) {
        console.error('[strava] webhook delete failed', err)
      }
    }
    await prisma.stravaConnection.deleteMany({ where: { userId: 'default' } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
