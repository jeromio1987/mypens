import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    await prisma.healthConnectConnection.deleteMany({ where: { userId: 'default' } })
    await prisma.pushedWorkout.deleteMany({ where: { source: 'healthconnect' } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
