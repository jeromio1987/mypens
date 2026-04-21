import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
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
