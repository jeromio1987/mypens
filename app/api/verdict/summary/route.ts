import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { calculateConfidence } from '@/lib/retentionModels'

export const dynamic = 'force-dynamic'

function dateNDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const CACHE_ID = 'singleton'
const WINDOW_CUTOFF_DAYS = 7

/** Last 7 days: same inclusive window as /api/verdict (date >= cutoff). */
async function collectWeekMetrics(cutoff: string) {
  const [weights, foods, sleeps, trainings, journals] = await Promise.all([
    prisma.weightEntry.findMany({
      where: { date: { gte: cutoff } },
      orderBy: { date: 'asc' },
    }),
    prisma.foodEntry.findMany({
      where: { date: { gte: cutoff } },
    }),
    prisma.sleepEntry.findMany({
      where: { date: { gte: cutoff } },
    }),
    prisma.trainingEntry.findMany({
      where: { date: { gte: cutoff } },
    }),
    prisma.journalEntry.findMany({
      where: { date: { gte: cutoff }, mood: { not: null } },
    }),
  ])

  let weightAvgLine = 'Weight: no entries this week.'
  let moodLine = ''

  if (weights.length > 0) {
    const sumTrue = weights.reduce((s, w) => s + w.trueWeightKg, 0)
    const avgTrue = sumTrue / weights.length

    const byDate = new Map<string, number[]>()
    for (const w of weights) {
      const list = byDate.get(w.date) ?? []
      list.push(w.trueWeightKg)
      byDate.set(w.date, list)
    }
    const sortedDates = [...byDate.keys()].sort()
    const firstMean =
      sortedDates.length > 0
        ? byDate.get(sortedDates[0])!.reduce((a, b) => a + b, 0) / byDate.get(sortedDates[0])!.length
        : avgTrue
    const lastMean =
      sortedDates.length > 0
        ? byDate.get(sortedDates[sortedDates.length - 1])!.reduce((a, b) => a + b, 0) /
          byDate.get(sortedDates[sortedDates.length - 1])!.length
        : avgTrue
    const delta = lastMean - firstMean
    const eps = 0.05
    const trend =
      delta > eps ? 'up' : delta < -eps ? 'down' : 'flat'
    const trendDelta = trend === 'flat' ? 0 : Math.abs(delta)

    const tally: { high: number; medium: number; low: number } = {
      high: 0,
      medium: 0,
      low: 0,
    }
    for (const w of weights) {
      const { level } = calculateConfidence({
        creatineRetentionKg: w.creatineRetentionKg,
        alcoholRetentionKg: w.alcoholRetentionKg,
        glycogenRetentionKg: w.glycogenRetentionKg,
        hardTraining: w.hardTraining,
        morningReading: w.morningReading,
        highSodium: w.highSodium,
        restaurantMeal: w.restaurantMeal,
        flightDay: w.flightDay,
        illnessDay: w.illnessDay,
      })
      tally[level]++
    }
    const modeConf = (['high', 'medium', 'low'] as const).reduce((a, b) =>
      tally[b] > tally[a] ? b : a,
    )

    weightAvgLine = `Weight: avg true weight ${avgTrue.toFixed(2)} kg, trend ${trend} ${trendDelta.toFixed(2)} kg, most common weigh-in confidence ${modeConf}`
  }

  const dayKcal = new Map<string, number>()
  const dayProt = new Map<string, number>()
  for (const f of foods) {
    dayKcal.set(f.date, (dayKcal.get(f.date) ?? 0) + f.kcal)
    dayProt.set(f.date, (dayProt.get(f.date) ?? 0) + f.proteinG)
  }
  const daysInWindow = 7
  const totalKcal = [...dayKcal.values()].reduce((s, v) => s + v, 0)
  const totalProt = [...dayProt.values()].reduce((s, v) => s + v, 0)
  const foodLine =
    foods.length === 0
      ? 'Food: no entries this week.'
      : `Food: avg ${(totalKcal / daysInWindow).toFixed(0)} kcal/day, avg ${(totalProt / daysInWindow).toFixed(0)}g protein`

  const sleepN = sleeps.length
  const sleepLine =
    sleepN === 0
      ? 'Sleep: no entries this week.'
      : `Sleep: avg ${(
          sleeps.reduce((s, x) => s + x.hours, 0) / sleepN
        ).toFixed(2)} hours, avg quality ${(sleeps.reduce((s, x) => s + x.quality, 0) / sleepN).toFixed(1)}/5`

  const trainDates = new Set(trainings.map(t => t.date))
  const vol = trainings.reduce((s, t) => s + t.volume, 0)
  const trainLine =
    trainings.length === 0
      ? 'Training: no sessions logged, total volume 0 kg.'
      : `Training: ${trainDates.size} sessions, ${Math.round(vol)} kg total volume`

  if (journals.length > 0) {
    const moodAvg =
      journals.reduce((s, j) => s + (j.mood ?? 0), 0) / journals.length
    moodLine = `Mood: avg ${moodAvg.toFixed(1)}/5`
  }

  return { weightAvgLine, foodLine, sleepLine, trainLine, moodLine }
}

function buildUserPrompt(lines: {
  weightAvgLine: string
  foodLine: string
  sleepLine: string
  trainLine: string
  moodLine: string
}): string {
  const moodBlock = lines.moodLine ? `\n${lines.moodLine}` : ''
  return `You are MY PENS Verdict — a no-nonsense personal health audit system.
Voice: direct, analytical, slight dry humour. No wellness platitudes. No em-dashes. No bullet points. Prose only.

The user's last 7 days:
${lines.weightAvgLine}
${lines.foodLine}
${lines.sleepLine}
${lines.trainLine}${moodBlock}

Write exactly 3 sentences. Lead with the single strongest signal (positive or negative). Second sentence connects two data points. Third sentence gives one concrete action for next week.
Hard limit: 75 words total.`
}

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ summary: null })
  }

  try {
    const twentyFourH = 24 * 60 * 60 * 1000
    const cached = await prisma.aiVerdictCache.findUnique({
      where: { id: CACHE_ID },
    })
    if (cached && Date.now() - cached.generatedAt.getTime() < twentyFourH) {
      return NextResponse.json({
        summary: cached.summary,
        cached: true,
        generatedAt: cached.generatedAt.toISOString(),
      })
    }

    const cutoff = dateNDaysAgo(WINDOW_CUTOFF_DAYS)
    const metrics = await collectWeekMetrics(cutoff)
    const userPrompt = buildUserPrompt(metrics)

    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      stream: false,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = msg.content
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()

    if (!text) {
      return NextResponse.json({ summary: null, error: true })
    }

    const now = new Date()
    await prisma.aiVerdictCache.upsert({
      where: { id: CACHE_ID },
      create: { id: CACHE_ID, summary: text, generatedAt: now },
      update: { summary: text, generatedAt: now },
    })

    return NextResponse.json({
      summary: text,
      cached: false,
      generatedAt: now.toISOString(),
    })
  } catch {
    return NextResponse.json({ summary: null, error: true })
  }
}
