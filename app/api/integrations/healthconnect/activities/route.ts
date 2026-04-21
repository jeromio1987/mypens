import { NextResponse } from 'next/server'
import { listPendingWorkouts } from '@/lib/integrations/healthconnect/api'
import { pushedToDraft } from '@/lib/integrations/healthconnect/mapping'
import { markAlreadyImported } from '@/lib/integrations/_shared/import'
import { getConnection } from '@/lib/integrations/healthconnect/auth'

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
