import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const ALLOWED_SPORTS = new Set([
  'running', 'cycling', 'walking', 'swimming', 'hiking',
  'strength_training', 'cardio_training', 'yoga', 'indoor_cycling',
  'transition', 'generic',
])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const yearRaw = searchParams.get('year')
    const sportRaw = searchParams.get('sport')
    const limitRaw = searchParams.get('limit')

    const year = yearRaw && /^\d{4}$/.test(yearRaw) ? yearRaw : null
    const sport = sportRaw && ALLOWED_SPORTS.has(sportRaw) ? sportRaw : null

    let limit = parseInt(limitRaw ?? '500', 10)
    if (!Number.isFinite(limit) || limit <= 0) limit = 500
    if (limit > 1000) limit = 1000

    const where: { date?: { startsWith: string }; sport?: string } = {}
    if (year) where.date = { startsWith: year }
    if (sport) where.sport = sport

    const activities = await prisma.garminActivity.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json(activities)
  } catch (error) {
    console.error('GET /api/garmin failed:', error)
    return NextResponse.json({ error: 'Failed to fetch Garmin activities' }, { status: 500 })
  }
}
