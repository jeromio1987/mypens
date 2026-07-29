import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rollingWindow, shiftDateStr, today } from '@/lib/timeWindow'

export const dynamic = 'force-dynamic'

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const todayStr = today()
  const yesterday = shiftDateStr(todayStr, -1)
  if (sorted[0] !== todayStr && sorted[0] !== yesterday) return 0
  let streak = 0
  let cursor = sorted[0]
  for (const d of sorted) {
    if (d === cursor) {
      streak++
      cursor = shiftDateStr(cursor, -1)
    } else break
  }
  return streak
}

async function getScoreForUser(userId: string) {
  if (userId !== 'default') {
    // Non-local user: return zeroes until they connect their own instance
    return { weeklyScore: 0, currentStreak: 0, medalsEarned: 0 }
  }

  const sevenDaysAgo = rollingWindow(7).from
  const [weightDates, trainingDates, sleepDates, foodDates, allWeight, allTraining] = await Promise.all([
    prisma.weightEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
    prisma.trainingEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
    prisma.sleepEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
    prisma.foodEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
    prisma.weightEntry.findMany({ where: { date: { gte: sevenDaysAgo } }, select: { date: true } }),
    prisma.trainingEntry.findMany({ where: { date: { gte: sevenDaysAgo } }, select: { date: true } }),
  ])

  const wStreak = calcStreak(weightDates.map(e => e.date))
  const tStreak = calcStreak(trainingDates.map(e => e.date))
  const sStreak = calcStreak(sleepDates.map(e => e.date))
  const fStreak = calcStreak(foodDates.map(e => e.date))
  const currentStreak = Math.max(wStreak, tStreak, sStreak, fStreak)

  // Weekly score: logged days × module multiplier (never raw values)
  const weeklyWeight = new Set(allWeight.map(e => e.date)).size
  const weeklyTraining = new Set(allTraining.map(e => e.date)).size
  const weeklyScore = weeklyWeight * 2 + weeklyTraining * 3

  // Medal count approximation (just streaks for privacy)
  const medalsEarned =
    (wStreak >= 3 ? 1 : 0) + (wStreak >= 7 ? 1 : 0) + (wStreak >= 14 ? 1 : 0) +
    (tStreak >= 3 ? 1 : 0) + (tStreak >= 7 ? 1 : 0) +
    (sStreak >= 7 ? 1 : 0) + (fStreak >= 7 ? 1 : 0)

  return { weeklyScore, currentStreak, medalsEarned }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId: clubIdRaw } = await params
    const clubId = Number(clubIdRaw)
    if (isNaN(clubId)) return NextResponse.json({ error: 'Invalid clubId' }, { status: 400 })

    const members = await prisma.clubMember.findMany({
      where: { clubId },
      orderBy: { joinedAt: 'asc' },
    })

    const rows = await Promise.all(
      members.map(async (m) => {
        const score = await getScoreForUser(m.userId)
        return { memberId: m.id, displayName: m.displayName, userId: m.userId, ...score }
      }),
    )

    rows.sort((a, b) => b.weeklyScore - a.weeklyScore || b.currentStreak - a.currentStreak)

    return NextResponse.json({ clubId, leaderboard: rows })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
