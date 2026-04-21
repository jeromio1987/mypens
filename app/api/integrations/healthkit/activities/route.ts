import { NextResponse } from 'next/server'
import { listPendingWorkouts } from '@/lib/integrations/healthkit/api'
import { pushedToDraft } from '@/lib/integrations/healthkit/mapping'
import { markAlreadyImported } from '@/lib/integrations/_shared/import'
import { getConnection } from '@/lib/integrations/healthkit/auth'

export async function GET() {
  try {
    const conn = await getConnection()
    if (!conn) return NextResponse.json({ error: 'Not connected to Apple Health' }, { status: 401 })
    const pushed = await listPendingWorkouts()
    const drafts = pushed.map(pushedToDraft)
    const items = await markAlreadyImported('healthkit', drafts)
    return NextResponse.json({ items })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}
