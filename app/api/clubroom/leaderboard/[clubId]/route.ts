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
    // Non-local user: scores unavailable until they connect their own instance (C1).
    // Do not return zeros that look like a real last-place ranking.
    return {
      weeklyScore: null as number | null,
      currentStreak: null as number | null,
      medalsEarned: null as number | null,
      scoreAvailable: false,
    }
  }

  const sevenDaysAgo = rollingWindow(7).from
  // Date-bounded queries only (no unbounded full-table scans per member).
  const streakFrom = shiftDateStr(today(), -60)
  const [weightDates, trainingDates, sleepDates, foodDates, allWeight, allTraining] = await Promise.all([
    prisma.weightEntry.findMany({
      where: { date: { gte: streakFrom } },
      select: { date: true },
      orderBy: { date: 'desc' },
    }),
    prisma.trainingEntry.findMany({
      where: { date: { gte: streakFrom } },
      select: { date: true },
      orderBy: { date: 'desc' },
    }),
    prisma.sleepEntry.findMany({
      where: { date: { gte: streakFrom } },
      select: { date: true },
      orderBy: { date: 'desc' },
    }),
    prisma.foodEntry.findMany({
      where: { date: { gte: streakFrom } },
      select: { date: true },
      orderBy: { date: 'desc' },
    }),
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

  return { weeklyScore, currentStreak, medalsEarned, scoreAvailable: true }
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

    // Only rank members with real scores — stub zeros must not look like competition (C1).
    const ranked = rows
      .filter(r => r.scoreAvailable)
      .sort(
        (a, b) =>
          (b.weeklyScore ?? 0) - (a.weeklyScore ?? 0) ||
          (b.currentStreak ?? 0) - (a.currentStreak ?? 0),
      )
    const unranked = rows.filter(r => !r.scoreAvailable)

    return NextResponse.json({
      clubId,
      leaderboard: ranked,
      unranked,
      note:
        unranked.length > 0
          ? 'Some members have no local score yet — they are listed unranked, not as zeros.'
          : undefined,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
