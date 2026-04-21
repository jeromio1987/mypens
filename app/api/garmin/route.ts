import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year   = searchParams.get('year')
    const sport  = searchParams.get('sport')
    const limit  = parseInt(searchParams.get('limit') ?? '500')

    const where: Record<string, unknown> = {}
    if (year)  where.date  = { startsWith: year }
    if (sport) where.sport = sport

    const activities = await (prisma as any).garminActivity.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json(activities)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch Garmin activities' }, { status: 500 })
  }
}
