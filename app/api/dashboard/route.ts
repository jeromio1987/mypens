import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function generateInsights(data: {
  weightEntries: { scaleKg: number; trueWeightKg: number; alcoholUnits: number; hardTraining: boolean; morningReading: boolean; carbsG: number }[]
  sleepEntries: { hours: number; quality: number }[]
  trainingEntries: { date: string; volume: number }[]
  foodEntries: { kcal: number; date: string }[]
}): string[] {
  const insights: string[] = []
  const { weightEntries, sleepEntries, trainingEntries, foodEntries } = data

  if (weightEntries.length < 2) return insights

  // Scale vs adjusted weight delta
  const newest = weightEntries[0]
  const oldest = weightEntries[weightEntries.length - 1]
  const scaleDelta = parseFloat((newest.scaleKg - oldest.scaleKg).toFixed(2))
  const adjDelta = parseFloat((newest.trueWeightKg - oldest.trueWeightKg).toFixed(2))
  const gapKg = parseFloat((Math.abs(scaleDelta - adjDelta)).toFixed(2))

  if (gapKg >= 0.5) {
    const scaleDir = scaleDelta >= 0 ? `+${scaleDelta}` : `${scaleDelta}`
    const adjDir = adjDelta >= 0 ? `+${adjDelta}` : `${adjDelta}`
    const hasAlcohol = weightEntries.some(e => e.alcoholUnits > 0)
    const hasHighCarbs = weightEntries.some(e => e.carbsG > 200)
    const reason = hasAlcohol ? 'alcohol' : hasHighCarbs ? 'high-carb days' : 'water retention'
    insights.push(
      `Scale ${scaleDir} kg this week but adjusted weight ${adjDir} kg — the gap (${gapKg} kg) is likely ${reason}.`
    )
  }

  // Sleep + weight correlation
  if (sleepEntries.length >= 3) {
    const avgSleep = sleepEntries.reduce((s, e) => s + e.hours, 0) / sleepEntries.length
    const avgQuality = sleepEntries.reduce((s, e) => s + e.quality, 0) / sleepEntries.length
    const poorSleep = avgSleep < 6.5 || avgQuality < 3
    if (poorSleep && scaleDelta > 0) {
      insights.push(
        `Average sleep this week: ${avgSleep.toFixed(1)}h at quality ${avgQuality.toFixed(1)}/5. Poor sleep raises cortisol and can mask fat loss on the scale.`
      )
    } else if (avgSleep >= 7.5 && avgQuality >= 4) {
      insights.push(`Sleep solid this week — ${avgSleep.toFixed(1)}h avg at quality ${avgQuality.toFixed(1)}/5. Good recovery conditions.`)
    }
  }

  // Training volume trend
  const sessionDates = [...new Set(trainingEntries.map(e => e.date))]
  if (sessionDates.length >= 3) {
    const totalVol = trainingEntries.reduce((s, e) => s + e.volume, 0)
    const hardTrainingDays = weightEntries.filter(e => e.hardTraining).length
    if (hardTrainingDays >= 2 && scaleDelta > 0.3) {
      insights.push(
        `${hardTrainingDays} hard training days logged — post-workout inflammation can temporarily add 0.3–0.8 kg on the scale.`
      )
    } else if (sessionDates.length >= 4) {
      insights.push(`${sessionDates.length} training sessions this week, ${Math.round(totalVol).toLocaleString()} kg total volume. Consistent week.`)
    }
  }

  // Calorie context
  if (foodEntries.length > 0) {
    const kcalByDate: Record<string, number> = {}
    for (const e of foodEntries) {
      kcalByDate[e.date] = (kcalByDate[e.date] ?? 0) + e.kcal
    }
    const dailyKcals = Object.values(kcalByDate)
    const avgKcal = dailyKcals.reduce((s, k) => s + k, 0) / dailyKcals.length
    if (adjDelta < -0.2 && avgKcal > 0) {
      insights.push(`Adjusted weight trending down with avg ${Math.round(avgKcal)} kcal/day — on track.`)
    } else if (adjDelta > 0.3 && avgKcal > 2800) {
      insights.push(`Adjusted weight up ${adjDelta} kg with avg ${Math.round(avgKcal)} kcal/day — worth checking if this is a surplus week.`)
    }
  }

  return insights.slice(0, 3) // cap at 3 insights
}

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

    // ── Insights ────────────────────────────────────────────────────────────
    const insights = generateInsights({
      weightEntries,
      sleepEntries,
      trainingEntries,
      foodEntries: food7,
    })

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
      insights,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
