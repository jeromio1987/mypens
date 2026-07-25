import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { importDrafts, type DraftItem } from '@/lib/integrations/_shared/import'
import { requireOwner } from '@/lib/integrations/requireOwner'

/** POST { items: DraftItem[] } — upsert TrainingEntry rows from approved Strava drafts. */
export async function POST(request: Request) {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    const body = await request.json()
    const items: DraftItem[] = Array.isArray(body?.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 })
    }

    const { created, skipped, updated } = await importDrafts('strava', items)

    await prisma.stravaConnection.updateMany({
      where: { userId: 'default' },
      data: { lastSyncAt: new Date() },
    })

    return NextResponse.json({ ok: true, created, skipped, updated })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}
