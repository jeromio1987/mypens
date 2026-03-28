import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateConfidence, estimateSodiumRetention, estimateHardTrainingRetention, assessTanitaReliability } from '@/lib/retentionModels'
import type { ConfidenceLevel } from '@/lib/retentionModels'

export interface StructuredInsight {
  id: string
  type: 'weight' | 'sleep' | 'training' | 'food' | 'event' | 'measurement'
  severity: 'info' | 'positive' | 'warning'
  title: string
  body: string
}

function generateInsights(data: {
  weightEntries: {
    scaleKg: number; trueWeightKg: number; alcoholUnits: number
    hardTraining: boolean; morningReading: boolean; carbsG: number
    creatineRetentionKg: number; alcoholRetentionKg: number; glycogenRetentionKg: number
    highSodium: boolean; restaurantMeal: boolean; flightDay: boolean; illnessDay: boolean
  }[]
  sleepEntries: { hours: number; quality: number; hrv: number | null }[]
  trainingEntries: { date: string; volume: number }[]
  foodEntries: { kcal: number; date: string }[]
  activeEvents: { type: string; label: string; startDate: string; endDate: string }[]
}): StructuredInsight[] {
  const insights: StructuredInsight[] = []
  const { weightEntries, sleepEntries, trainingEntries, foodEntries, activeEvents } = data

  // Active event context
  if (activeEvents.length > 0) {
    const eventNames = activeEvents.map(e => e.label).join(', ')
    const hasTravel = activeEvents.some(e => e.type === 'travel' || e.type === 'holiday')
    const hasIllness = activeEvents.some(e => e.type === 'illness')
    if (hasIllness) {
      insights.push({
        id: 'event-illness',
        type: 'event',
        severity: 'warning',
        title: 'Illness period active',
        body: `You have an active illness event (${eventNames}). Scale and body composition readings are unreliable during inflammation — treat this week's data as informational only.`,
      })
    } else if (hasTravel) {
      insights.push({
        id: 'event-travel',
        type: 'event',
        severity: 'info',
        title: 'Travel or holiday active',
        body: `${eventNames} is active. Travel typically involves irregular eating, less sleep, and fluid retention from flights and restaurant food — scale spikes are expected and temporary.`,
      })
    } else {
      insights.push({
        id: 'event-other',
        type: 'event',
        severity: 'info',
        title: `Event active: ${eventNames}`,
        body: 'Your logged event may be affecting your scale readings this week. Use it as context when interpreting trends.',
      })
    }
  }

  if (weightEntries.length < 2) return insights

  const newest = weightEntries[0]
  const oldest = weightEntries[weightEntries.length - 1]
  const scaleDelta = parseFloat((newest.scaleKg - oldest.scaleKg).toFixed(2))
  const adjDelta = parseFloat((newest.trueWeightKg - oldest.trueWeightKg).toFixed(2))
  const gapKg = parseFloat(Math.abs(scaleDelta - adjDelta).toFixed(2))

  // Scale vs adjusted gap
  if (gapKg >= 0.5) {
    const scaleDir = scaleDelta >= 0 ? `+${scaleDelta}` : `${scaleDelta}`
    const adjDir = adjDelta >= 0 ? `+${adjDelta}` : `${adjDelta}`
    const hasAlcohol = weightEntries.some(e => e.alcoholUnits > 0)
    const hasHighCarbs = weightEntries.some(e => e.carbsG > 200)
    const reason = hasAlcohol ? 'alcohol-related water retention' : hasHighCarbs ? 'high-carb days loading glycogen' : 'water retention from logged confounders'
    insights.push({
      id: 'weight-gap',
      type: 'weight',
      severity: adjDelta <= 0 ? 'positive' : 'info',
      title: adjDelta <= 0 ? 'Scale up, true weight stable or down' : 'Scale and adjusted weight diverging',
      body: `Scale ${scaleDir} kg this week but adjusted weight ${adjDir} kg — the ${gapKg} kg gap is likely ${reason}. Your adjusted trend is what matters for fat loss progress.`,
    })
  } else if (adjDelta < -0.2) {
    insights.push({
      id: 'weight-trending-down',
      type: 'weight',
      severity: 'positive',
      title: 'Adjusted weight trending down',
      body: `Adjusted weight is down ${Math.abs(adjDelta)} kg this week with minimal water retention noise — a clean signal of progress.`,
    })
  }

  // Sleep
  if (sleepEntries.length >= 3) {
    const avgSleep = sleepEntries.reduce((s, e) => s + e.hours, 0) / sleepEntries.length
    const avgQuality = sleepEntries.reduce((s, e) => s + e.quality, 0) / sleepEntries.length
    const hrvEntries = sleepEntries.flatMap(e => e.hrv != null ? [e.hrv] : [])
    const avgHrv = hrvEntries.length ? hrvEntries.reduce((a, b) => a + b, 0) / hrvEntries.length : null

    const poorSleep = avgSleep < 6.5 || avgQuality < 3
    if (poorSleep && scaleDelta > 0) {
      insights.push({
        id: 'sleep-poor',
        type: 'sleep',
        severity: 'warning',
        title: 'Poor sleep may be masking progress',
        body: `Averaging ${avgSleep.toFixed(1)}h at quality ${avgQuality.toFixed(1)}/5 this week. Poor sleep elevates cortisol, increases water retention, and can make the scale read higher even during a calorie deficit.`,
      })
    } else if (avgSleep >= 7.5 && avgQuality >= 4) {
      const hrvNote = avgHrv != null ? ` HRV averaging ${Math.round(avgHrv)} ms.` : ''
      insights.push({
        id: 'sleep-good',
        type: 'sleep',
        severity: 'positive',
        title: 'Strong recovery this week',
        body: `Sleep solid at ${avgSleep.toFixed(1)}h avg, quality ${avgQuality.toFixed(1)}/5.${hrvNote} Good recovery conditions for body composition changes to register accurately.`,
      })
    }
  }

  // Training
  const sessionDates = [...new Set(trainingEntries.map(e => e.date))]
  if (sessionDates.length >= 2) {
    const totalVol = trainingEntries.reduce((s, e) => s + e.volume, 0)
    const hardTrainingDays = weightEntries.filter(e => e.hardTraining).length

    if (hardTrainingDays >= 2 && scaleDelta > 0.3) {
      insights.push({
        id: 'training-inflammation',
        type: 'training',
        severity: 'info',
        title: 'Training inflammation may be masking scale',
        body: `${hardTrainingDays} hard training days logged this week. Post-workout DOMS and inflammation can temporarily add 0.3–0.8 kg on the scale, even as you lose fat. The adjusted weight strips ~0.3 kg per hard day.`,
      })
    } else if (sessionDates.length >= 4) {
      insights.push({
        id: 'training-consistent',
        type: 'training',
        severity: 'positive',
        title: 'Consistent training week',
        body: `${sessionDates.length} sessions logged, ${Math.round(totalVol).toLocaleString()} kg total volume. Consistency is the foundation — good week.`,
      })
    }
  }

  // Food
  if (foodEntries.length > 0) {
    const kcalByDate: Record<string, number> = {}
    for (const e of foodEntries) { kcalByDate[e.date] = (kcalByDate[e.date] ?? 0) + e.kcal }
    const dailyKcals = Object.values(kcalByDate)
    const avgKcal = dailyKcals.reduce((s, k) => s + k, 0) / dailyKcals.length

    if (adjDelta < -0.2 && avgKcal > 0) {
      insights.push({
        id: 'food-deficit',
        type: 'food',
        severity: 'positive',
        title: 'Deficit and weight trending together',
        body: `Adjusted weight down with avg ${Math.round(avgKcal)} kcal/day — the data is consistent. Keep logging to maintain this signal.`,
      })
    } else if (adjDelta > 0.3 && avgKcal > 2800) {
      insights.push({
        id: 'food-surplus',
        type: 'food',
        severity: 'warning',
        title: 'High intake week, weight trending up',
        body: `Adjusted weight up ${adjDelta} kg with avg ${Math.round(avgKcal)} kcal/day. If this wasn't an intentional surplus week, it may be worth reviewing portion sizes.`,
      })
    }
  }

  return insights.slice(0, 4)
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

    // Re-derive v3 true weight and confidence for latest entry
    let latestConfidence: ConfidenceLevel | null = null
    let latestActiveConfounders = 0
    let latestTrueWeightKg = latestWeight?.trueWeightKg ?? null

    if (latestWeight) {
      const sodiumKg = estimateSodiumRetention(latestWeight.highSodium, latestWeight.restaurantMeal)
      const hardTrainingKg = estimateHardTrainingRetention(latestWeight.hardTraining)
      latestTrueWeightKg = parseFloat(
        (latestWeight.scaleKg - latestWeight.creatineRetentionKg - latestWeight.alcoholRetentionKg - latestWeight.glycogenRetentionKg - sodiumKg - hardTrainingKg).toFixed(2)
      )
      const conf = calculateConfidence({
        creatineRetentionKg: latestWeight.creatineRetentionKg,
        alcoholRetentionKg: latestWeight.alcoholRetentionKg,
        glycogenRetentionKg: latestWeight.glycogenRetentionKg,
        hardTraining: latestWeight.hardTraining,
        morningReading: latestWeight.morningReading,
        highSodium: latestWeight.highSodium,
        restaurantMeal: latestWeight.restaurantMeal,
        flightDay: latestWeight.flightDay,
        illnessDay: latestWeight.illnessDay,
      })
      latestConfidence = conf.level
      latestActiveConfounders = conf.activeConfounders
    }

    const weightAvg7 = avg(weightEntries.map(e => e.trueWeightKg).filter(Boolean))
    const weightTrend =
      weightEntries.length >= 2
        ? weightEntries[0].trueWeightKg - weightEntries[weightEntries.length - 1].trueWeightKg
        : null

    // ── Food ────────────────────────────────────────────────────────────────
    const foodToday = await prisma.foodEntry.findMany({ where: { date: today } })
    const food7 = await prisma.foodEntry.findMany({ where: { date: { gte: sevenDaysAgo } } })

    const todayKcal = foodToday.reduce((s, e) => s + e.kcal, 0)
    const todayProtein = foodToday.reduce((s, e) => s + e.proteinG, 0)
    const todayCarbs = foodToday.reduce((s, e) => s + e.carbsG, 0)
    const todayFat = foodToday.reduce((s, e) => s + e.fatG, 0)

    const kcalByDate: Record<string, number> = {}
    for (const e of food7) { kcalByDate[e.date] = (kcalByDate[e.date] ?? 0) + e.kcal }
    const avgKcal7 = avg(Object.values(kcalByDate))

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
    ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([exercise, volume]) => ({ exercise, volume }))

    // ── Measurements ────────────────────────────────────────────────────────
    const measurements = await prisma.bodyMeasurement.findMany({ orderBy: { date: 'desc' }, take: 2 })
    const latestMeasurement = measurements[0] ?? null
    const prevMeasurement = measurements[1] ?? null

    // ── Events ──────────────────────────────────────────────────────────────
    const allEvents = await prisma.eventTag.findMany({ orderBy: { startDate: 'desc' } })
    const activeEvents = allEvents.filter(e => e.startDate <= today && e.endDate >= today)
    const recentEvents = allEvents.filter(e => e.endDate >= sevenDaysAgo)

    // ── Insights ────────────────────────────────────────────────────────────
    const structuredInsights = generateInsights({
      weightEntries,
      sleepEntries,
      trainingEntries,
      foodEntries: food7,
      activeEvents,
    })

    // ── Weight breakdown for explanation card ───────────────────────────────
    let latestBreakdown: {
      creatineKg: number; alcoholKg: number; glycogenKg: number
      sodiumKg: number; hardTrainingKg: number; totalAdjustmentKg: number
      tanitaFlags: string[]
    } | null = null

    if (latestWeight) {
      const tanita = assessTanitaReliability({
        creatineDoseG:     latestWeight.creatineDoseG,
        creatineDaysOn:    latestWeight.creatineDaysOn,
        hoursSinceAlcohol: latestWeight.alcoholUnits > 0 ? 12 : 999,
        hardTraining:      latestWeight.hardTraining,
        morningReading:    latestWeight.morningReading,
        highSodium:        latestWeight.highSodium,
        restaurantMeal:    latestWeight.restaurantMeal,
        flightDay:         latestWeight.flightDay,
        illnessDay:        latestWeight.illnessDay,
      })
      const sodiumKg       = estimateSodiumRetention(latestWeight.highSodium, latestWeight.restaurantMeal)
      const hardTrainingKg = estimateHardTrainingRetention(latestWeight.hardTraining)
      const total = parseFloat(
        (latestWeight.creatineRetentionKg + latestWeight.alcoholRetentionKg + latestWeight.glycogenRetentionKg + sodiumKg + hardTrainingKg).toFixed(2)
      )
      latestBreakdown = {
        creatineKg:        latestWeight.creatineRetentionKg,
        alcoholKg:         latestWeight.alcoholRetentionKg,
        glycogenKg:        latestWeight.glycogenRetentionKg,
        sodiumKg,
        hardTrainingKg,
        totalAdjustmentKg: total,
        tanitaFlags:       tanita.flags,
      }
    }

    return NextResponse.json({
      weight: {
        latest: latestWeight
          ? {
              scaleKg: latestWeight.scaleKg,
              trueWeightKg: latestTrueWeightKg,
              date: latestWeight.date,
              confidence: latestConfidence,
              activeConfounders: latestActiveConfounders,
              breakdown: latestBreakdown,
            }
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
        avgHours7, avgQuality7, avgHrv7,
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
            ? parseFloat((latestMeasurement.waistCm - prevMeasurement.waistCm).toFixed(1)) : null,
          chestCm: latestMeasurement.chestCm != null && prevMeasurement.chestCm != null
            ? parseFloat((latestMeasurement.chestCm - prevMeasurement.chestCm).toFixed(1)) : null,
        } : null,
      },
      events: {
        active: activeEvents,
        recent: recentEvents,
      },
      insights: structuredInsights,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
