import { NextResponse } from 'next/server'
import { listPendingWorkouts } from '@/lib/integrations/healthconnect/api'
import { pushedToDraft } from '@/lib/integrations/healthconnect/mapping'
import { markAlreadyImported } from '@/lib/integrations/_shared/import'
import { getConnection } from '@/lib/integrations/healthconnect/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const conn = await getConnection()
    if (!conn) return NextResponse.json({ error: 'Not connected to Health Connect' }, { status: 401 })
    const pushed = await listPendingWorkouts()
    const drafts = pushed.map(pushedToDraft)
    const items = await markAlreadyImported('healthconnect', drafts)
    return NextResponse.json({ items })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const conn = await getConnection()
    if (!conn) return NextResponse.json({ error: 'Not connected to Health Connect' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    let ids: string[] = []
    if (id) {
      ids = [id]
    } else {
      try {
        const body = await req.json()
        if (Array.isArray(body?.ids)) ids = body.ids.filter((x: unknown): x is string => typeof x === 'string')
      } catch {
        // no body
      }
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Provide ?id=<externalId> or a JSON body { ids: string[] }' },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.pushedWorkout.deleteMany({
        where: { source: 'healthconnect', externalId: { in: ids } },
      })
      for (const externalId of ids) {
        await tx.skippedPushedWorkout.upsert({
          where: { source_externalId: { source: 'healthconnect', externalId } },
          create: { source: 'healthconnect', externalId },
          update: { skippedAt: new Date() },
        })
      }
      return deleted
    })
    return NextResponse.json({ deleted: result.count })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete activities' }, { status: 500 })
  }
}
