import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOwner } from '@/lib/integrations/requireOwner'

export async function POST() {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    await prisma.healthkitConnection.deleteMany({ where: { userId: 'default' } })
    // Drop any pending (unimported) workouts; keep TrainingEntry rows intact.
    await prisma.pushedWorkout.deleteMany({ where: { source: 'healthkit' } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
