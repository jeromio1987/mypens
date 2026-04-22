import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { importDrafts, type DraftItem } from '@/lib/integrations/_shared/import'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const items: DraftItem[] = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 })
    }
    const { created, skipped } = await importDrafts('garmin', items)
    await prisma.garminConnection.updateMany({
      where: { userId: 'default' },
      data: { lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
    })
    return NextResponse.json({ ok: true, created, skipped })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : String(err)
    await prisma.garminConnection.updateMany({
      where: { userId: 'default' },
      data: { lastError: message.slice(0, 500), lastErrorAt: new Date() },
    })
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}
