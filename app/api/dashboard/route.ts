import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function nDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2))
}

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = nDaysAgo(7)

    // ── Weight ──────────────────────────────────────────────────────────────
    const weightEntries = await prisma.weightEntry.findMany({
      where: { date: { gte: sevenDaysAgo } },
      orderBy: { date: 'desc' },
    })
    const latestWeight = weightEntries[0] ?? null
    const weightAvg7 = avg(weightEntries.map(e => e.trueWeightKg).filter(Boolean))
    const weightTrend =
      weightEntries.length >= 2
        ? weightEntries[0].trueWeightKg - weightEntries[weightEntries.length - 1].trueWeightKg
        : null

    // ── Food ────────────────────────────────────────────────────────────────
    const foodToday = await prisma.foodEntry.findMany({ where: { date: today } })
    const food7 = await prisma.foodEntry.findMany({
      where: { date: { gte: sevenDaysAgo } },
    })

    const todayKcal = foodToday.reduce((s, e) => s + e.kcal, 0)
    const todayProtein = foodToday.reduce((s, e) => s + e.proteinG, 0)
    const todayCarbs = foodToday.reduce((s, e) => s + e.carbsG, 0)
    const todayFat = foodToday.reduce((s, e) => s + e.fatG, 0)

    // Group by date to get daily kcal averages
    const kcalByDate: Record<string, number> = {}
    for (const e of food7) {
      kcalByDate[e.date] = (kcalByDate[e.date] ?? 0) + e.kcal
    }
    const dailyKcals = Object.values(kcalByDate)
    const avgKcal7 = avg(dailyKcals)

    // ── Sleep ───────────────────────────────────────────────────────────────
    const sleepEntries = await prisma.sleepEntry.findMany({
      where: { date: { gte: sevenDaysAgo } },
      orderBy: { date: 'desc' },
    })
    const latestSleep = sleepEntries[0] ?? null
    const avgHours7 = avg(sleepEntries.map(e => e.hours))
    const avgQuality7 = avg(sleepEntries.map(e => e.quality))
    const avgHrv7 = avg(sleepEntries.flatMap(e => (e.hrv != null ? [e.hrv] : [])))

    // ── Training ────────────────────────────────────────────────────────────
    const trainingEntries = await prisma.trainingEntry.findMany({
      where: { date: { gte: sevenDaysAgo } },
      orderBy: { date: 'desc' },
    })
    const sessionDates = [...new Set(trainingEntries.map(e => e.date))]
    const weekSessions = sessionDates.length
    const weekVolume = trainingEntries.reduce((s, e) => s + e.volume, 0)
    const topExercises = Object.entries(
      trainingEntries.reduce<Record<string, number>>((acc, e) => {
        acc[e.exercise] = (acc[e.exercise] ?? 0) + e.volume
        return acc
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([exercise, volume]) => ({ exercise, volume }))

    // ── Measurements ────────────────────────────────────────────────────────
    const measurements = await prisma.bodyMeasurement.findMany({
      orderBy: { date: 'desc' },
      take: 2,
    })
    const latestMeasurement = measurements[0] ?? null
    const prevMeasurement = measurements[1] ?? null

    return NextResponse.json({
      weight: {
        latest: latestWeight
          ? { scaleKg: latestWeight.scaleKg, trueWeightKg: latestWeight.trueWeightKg, date: latestWeight.date }
          : null,
        avg7: weightAvg7,
        trend7: weightTrend != null ? parseFloat(weightTrend.toFixed(2)) : null,
      },
      food: {
        today: { kcal: todayKcal, proteinG: todayProtein, carbsG: todayCarbs, fatG: todayFat, entries: foodToday.length },
        avgKcal7,
      },
      sleep: {
        latest: latestSleep
          ? { hours: latestSleep.hours, quality: latestSleep.quality, bedtime: latestSleep.bedtime, wakeTime: latestSleep.wakeTime, date: latestSleep.date }
          : null,
        avgHours7,
        avgQuality7,
        avgHrv7,
        daysLogged: sleepEntries.length,
      },
      training: {
        weekSessions,
        weekVolume: parseFloat(weekVolume.toFixed(0)),
        topExercises,
        lastDate: trainingEntries[0]?.date ?? null,
      },
      measurements: {
        latest: latestMeasurement,
        delta: latestMeasurement && prevMeasurement ? {
          waistCm: latestMeasurement.waistCm != null && prevMeasurement.waistCm != null
            ? parseFloat((latestMeasurement.waistCm - prevMeasurement.waistCm).toFixed(1))
            : null,
          chestCm: latestMeasurement.chestCm != null && prevMeasurement.chestCm != null
            ? parseFloat((latestMeasurement.chestCm - prevMeasurement.chestCm).toFixed(1))
            : null,
        } : null,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
