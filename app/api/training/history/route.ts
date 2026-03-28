import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const exercise = searchParams.get('exercise')

    if (!exercise) {
      return NextResponse.json({ error: 'exercise param required' }, { status: 400 })
    }

    const entries = await prisma.trainingEntry.findMany({
      where: { exercise },
      orderBy: { date: 'asc' },
    })

    const personalBest = entries.reduce<number>((best, e) => Math.max(best, e.weightKg), 0)

    return NextResponse.json({ entries, personalBest })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
