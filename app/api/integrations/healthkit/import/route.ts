import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { importDrafts, type DraftItem } from '@/lib/integrations/_shared/import'
import { requireOwner } from '@/lib/integrations/requireOwner'

export async function POST(request: Request) {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    const body = await request.json()
    const items: DraftItem[] = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 })
    }
    const { created, skipped, updated } = await importDrafts('healthkit', items)
    // Drop the corresponding queued rows so /status pendingCount reflects true backlog.
    const ids = items.map(i => i.externalId).filter(Boolean)
    if (ids.length) {
      await prisma.pushedWorkout.deleteMany({
        where: { source: 'healthkit', externalId: { in: ids } },
      })
    }
    await prisma.healthkitConnection.updateMany({
      where: { userId: 'default' },
      data: { lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
    })
    return NextResponse.json({ ok: true, created, skipped, updated })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : String(err)
    await prisma.healthkitConnection.updateMany({
      where: { userId: 'default' },
      data: { lastError: message.slice(0, 500), lastErrorAt: new Date() },
    })
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}
