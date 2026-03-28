import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Medal {
  id: string
  label: string
  description: string
  category: 'streak' | 'milestone' | 'progress' | 'special'
  icon: string        // lucide icon name
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  earned: boolean
  earnedDate?: string // iso date
}

export interface WeeklyWrap {
  weekLabel: string
  weightTrend: { from: number | null; to: number | null; delta: number | null }
  trainingSessions: number
  trainingVolume: number
  sleepAvgHours: number | null
  sleepAvgQuality: number | null
  avgKcal: number | null
  headline: string
}

export interface ReportCard {
  whatHappened: string
  whatItMeans: string
  whatNext: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nDaysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function avg(arr: number[]) {
  if (!arr.length) return null
  return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1))
}

function calcCurrentStreak(dates: string[]): number {
  if (!dates.length) return 0
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = nDaysAgo(1)
  const mostRecent = sorted[0]
  if (mostRecent !== todayStr && mostRecent !== yesterdayStr) return 0
  let current = 0
  let cursor = mostRecent
  for (const d of sorted) {
    if (d === cursor) {
      current++
      const prev = new Date(cursor + 'T00:00:00')
      prev.setDate(prev.getDate() - 1)
      cursor = prev.toISOString().slice(0, 10)
    } else break
  }
  return current
}

// ── Medal computation ──────────────────────────────────────────────────────────

function computeMedals(data: {
  weightDates: string[]
  foodDates: string[]
  sleepDates: string[]
  trainingDates: string[]
  measurementDates: string[]
  weightEntries: { date: string; trueWeightKg: number }[]
  trainingCount: number
  totalModulesUsed: number
}): Medal[] {
  const medals: Medal[] = []

  const wStreak  = calcCurrentStreak(data.weightDates)
  const tStreak  = calcCurrentStreak(data.trainingDates)
  const slStreak = calcCurrentStreak(data.sleepDates)
  const fStreak  = calcCurrentStreak(data.foodDates)

  const wTotal = new Set(data.weightDates).size
  const tTotal = data.trainingCount
  const slTotal = new Set(data.sleepDates).size

  // ── Streak medals ──
  medals.push({
    id: 'streak-weight-3', label: 'Consistent', tier: 'bronze',
    description: '3-day weight logging streak', category: 'streak', icon: 'Flame',
    earned: wStreak >= 3,
  })
  medals.push({
    id: 'streak-weight-7', label: 'Week Lock', tier: 'silver',
    description: '7 consecutive weigh-ins', category: 'streak', icon: 'Flame',
    earned: wStreak >= 7,
  })
  medals.push({
    id: 'streak-weight-14', label: 'Fortnight', tier: 'gold',
    description: '14-day weight streak', category: 'streak', icon: 'Flame',
    earned: wStreak >= 14,
  })
  medals.push({
    id: 'streak-weight-30', label: 'The Habit', tier: 'platinum',
    description: '30 days straight on the scale', category: 'streak', icon: 'Flame',
    earned: wStreak >= 30,
  })
  medals.push({
    id: 'streak-training-3', label: 'Moving', tier: 'bronze',
    description: '3 training sessions in a row', category: 'streak', icon: 'Dumbbell',
    earned: tStreak >= 3,
  })
  medals.push({
    id: 'streak-training-7', label: 'Block Week', tier: 'silver',
    description: '7-day training streak', category: 'streak', icon: 'Dumbbell',
    earned: tStreak >= 7,
  })
  medals.push({
    id: 'streak-sleep-7', label: 'Sleep Hygiene', tier: 'silver',
    description: '7 nights of logged sleep', category: 'streak', icon: 'Moon',
    earned: slStreak >= 7,
  })
  medals.push({
    id: 'streak-food-7', label: 'Logged In', tier: 'silver',
    description: '7 consecutive days of food logging', category: 'streak', icon: 'UtensilsCrossed',
    earned: fStreak >= 7,
  })

  // ── Milestone medals ──
  medals.push({
    id: 'milestone-first-weight', label: 'First Reading', tier: 'bronze',
    description: 'Logged your first weigh-in', category: 'milestone', icon: 'Scale',
    earned: wTotal >= 1,
  })
  medals.push({
    id: 'milestone-10-weights', label: '10 Readings', tier: 'bronze',
    description: '10 weight entries logged', category: 'milestone', icon: 'Scale',
    earned: wTotal >= 10,
  })
  medals.push({
    id: 'milestone-50-weights', label: 'Committed', tier: 'gold',
    description: '50 weight entries — this is a habit', category: 'milestone', icon: 'Scale',
    earned: wTotal >= 50,
  })
  medals.push({
    id: 'milestone-first-training', label: 'First Session', tier: 'bronze',
    description: 'Logged your first training session', category: 'milestone', icon: 'Dumbbell',
    earned: tTotal >= 1,
  })
  medals.push({
    id: 'milestone-25-sessions', label: '25 Sessions', tier: 'silver',
    description: '25 training sessions logged', category: 'milestone', icon: 'Trophy',
    earned: tTotal >= 25,
  })
  medals.push({
    id: 'milestone-sleep-30', label: 'Night Owl', tier: 'silver',
    description: '30 nights of sleep logged', category: 'milestone', icon: 'Moon',
    earned: slTotal >= 30,
  })

  // ── Progress medals (weight loss) ──
  const weightSorted = [...data.weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  const firstTrue = weightSorted[0]?.trueWeightKg ?? null
  const latestTrue = weightSorted[weightSorted.length - 1]?.trueWeightKg ?? null
  const kgLost = firstTrue && latestTrue ? parseFloat((firstTrue - latestTrue).toFixed(2)) : 0

  medals.push({
    id: 'progress-1kg', label: 'First Kilo', tier: 'bronze',
    description: 'Lost 1 kg of adjusted true weight', category: 'progress', icon: 'TrendingDown',
    earned: kgLost >= 1,
  })
  medals.push({
    id: 'progress-5kg', label: 'Five Down', tier: 'gold',
    description: 'Lost 5 kg of adjusted true weight', category: 'progress', icon: 'TrendingDown',
    earned: kgLost >= 5,
  })
  medals.push({
    id: 'progress-10kg', label: 'Double Digits', tier: 'platinum',
    description: 'Lost 10 kg — extraordinary progress', category: 'progress', icon: 'TrendingDown',
    earned: kgLost >= 10,
  })

  // ── Special medals ──
  medals.push({
    id: 'special-full-kit', label: 'Full Kit', tier: 'gold',
    description: 'Logged all 5 modules at least once', category: 'special', icon: 'Layers',
    earned: data.totalModulesUsed === 5,
  })
  medals.push({
    id: 'special-pens-way', label: 'The P.E.N.S. Way', tier: 'platinum',
    description: 'Active streaks in weight, food, sleep and training simultaneously',
    category: 'special', icon: 'Star',
    earned: wStreak >= 3 && fStreak >= 3 && slStreak >= 3 && tStreak >= 3,
  })

  return medals
}

// ── Weekly wrap ────────────────────────────────────────────────────────────────

function buildWeeklyWrap(
  weightEntries: { date: string; trueWeightKg: number }[],
  trainingEntries: { date: string; volume: number }[],
  sleepEntries: { hours: number; quality: number }[],
  foodEntries: { date: string; kcal: number }[],
): WeeklyWrap {
  const start = nDaysAgo(6)
  const end   = new Date().toISOString().slice(0, 10)

  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const weekLabel = `${fmt(start)} – ${fmt(end)}`

  const wSorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  const weightFrom  = wSorted[0]?.trueWeightKg ?? null
  const weightTo    = wSorted[wSorted.length - 1]?.trueWeightKg ?? null
  const weightDelta = weightFrom && weightTo ? parseFloat((weightTo - weightFrom).toFixed(2)) : null

  const sessionDates = [...new Set(trainingEntries.map(e => e.date))]
  const trainingSessions = sessionDates.length
  const trainingVolume   = Math.round(trainingEntries.reduce((s, e) => s + e.volume, 0))

  const sleepAvgHours   = avg(sleepEntries.map(e => e.hours))
  const sleepAvgQuality = avg(sleepEntries.map(e => e.quality))

  const kcalByDate: Record<string, number> = {}
  for (const e of foodEntries) kcalByDate[e.date] = (kcalByDate[e.date] ?? 0) + e.kcal
  const avgKcal = avg(Object.values(kcalByDate).map(Math.round))

  // Generate headline
  let headline = 'A quiet week. That\'s fine.'
  if (weightDelta !== null) {
    if (weightDelta < -0.3) headline = `Adjusted weight down ${Math.abs(weightDelta)} kg — solid progress this week.`
    else if (weightDelta > 0.5) headline = `Adjusted weight up ${weightDelta} kg — worth reviewing what drove it.`
    else headline = 'Adjusted weight stable this week — consistency is compounding.'
  }
  if (trainingSessions >= 4) headline += ` ${trainingSessions} sessions in the books.`

  return { weekLabel, weightTrend: { from: weightFrom, to: weightTo, delta: weightDelta }, trainingSessions, trainingVolume, sleepAvgHours, sleepAvgQuality, avgKcal, headline }
}

// ── Report to Self ─────────────────────────────────────────────────────────────

function buildReportToSelf(
  weightEntries: { date: string; scaleKg: number; trueWeightKg: number; activeConfounders?: number }[],
  sleepEntries: { hours: number; quality: number }[],
  trainingEntries: { date: string }[],
  foodEntries: { date: string; kcal: number }[],
): ReportCard {
  const wSorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  const latestW = wSorted[wSorted.length - 1]
  const firstW  = wSorted[0]
  const weekDelta = latestW && firstW ? parseFloat((latestW.trueWeightKg - firstW.trueWeightKg).toFixed(2)) : null

  const avgSleep = sleepEntries.length
    ? parseFloat((sleepEntries.reduce((s, e) => s + e.hours, 0) / sleepEntries.length).toFixed(1))
    : null
  const avgQuality = sleepEntries.length
    ? parseFloat((sleepEntries.reduce((s, e) => s + e.quality, 0) / sleepEntries.length).toFixed(1))
    : null

  const sessions = new Set(trainingEntries.map(e => e.date)).size

  const kcalByDate: Record<string, number> = {}
  for (const e of foodEntries) kcalByDate[e.date] = (kcalByDate[e.date] ?? 0) + e.kcal
  const avgKcal = Object.values(kcalByDate).length
    ? Math.round(Object.values(kcalByDate).reduce((a, b) => a + b, 0) / Object.values(kcalByDate).length)
    : null

  // What happened
  const parts: string[] = []
  if (latestW) parts.push(`Scale read ${latestW.scaleKg} kg, adjusted true weight ${latestW.trueWeightKg} kg.`)
  if (weekDelta !== null) parts.push(`Over the week, adjusted weight moved ${weekDelta > 0 ? '+' : ''}${weekDelta} kg.`)
  if (sessions > 0) parts.push(`${sessions} training session${sessions > 1 ? 's' : ''} completed.`)
  if (avgSleep !== null) parts.push(`Sleep averaged ${avgSleep}h at quality ${avgQuality}/5.`)
  if (avgKcal !== null) parts.push(`Food intake averaged around ${avgKcal} kcal/day.`)
  const whatHappened = parts.length ? parts.join(' ') : 'Nothing to report yet. Check back Sunday.'

  // What it means
  const meaning: string[] = []
  if (weekDelta !== null && weekDelta < -0.2) meaning.push('The downward adjusted trend is a real signal — not noise.')
  else if (weekDelta !== null && weekDelta > 0.5) meaning.push('The scale is up, but check how many confounders were active. True fat gain needs a sustained surplus.')
  else if (weekDelta !== null) meaning.push('Stable adjusted weight with good logging is a win — you\'re holding position.')
  if (avgSleep !== null && avgSleep < 6.5) meaning.push('Short sleep raises cortisol and can mask fat loss on the scale.')
  else if (avgSleep !== null && avgSleep >= 7.5) meaning.push('Good sleep creates the right conditions for body composition to shift.')
  if (sessions >= 4) meaning.push('Four or more sessions suggests a real training week — inflammation may add temporary scale weight.')
  const whatItMeans = meaning.length ? meaning.join(' ') : 'A quiet week. The system is ready when you are.'

  // What next
  const next: string[] = []
  if (weekDelta !== null && weekDelta < -0.3) next.push('Keep doing what you\'re doing. Don\'t overcorrect a working system.')
  else if (weekDelta !== null && weekDelta > 0.5) next.push('Audit last week\'s restaurant meals, late eating, and alcohol units. One of those is usually the culprit.')
  else next.push('Focus on consistency over perfection. Seven logged days beats one perfect day.')
  if (avgSleep !== null && avgSleep < 7) next.push('Prioritise 30 extra minutes of sleep — it\'s the highest-leverage recovery tool you have.')
  if (sessions === 0 && weekDelta !== null && weekDelta > 0.3) next.push('One training session this week would support the recovery.')
  const whatNext = next.join(' ')

  return { whatHappened, whatItMeans, whatNext }
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sevenDaysAgo = nDaysAgo(7)

    const [
      allWeightEntries,
      allFoodEntries,
      allSleepEntries,
      allTrainingEntries,
      allMeasurements,
      weekFood,
      weekSleep,
      weekTraining,
    ] = await Promise.all([
      prisma.weightEntry.findMany({ select: { date: true, trueWeightKg: true, scaleKg: true }, orderBy: { date: 'asc' } }),
      prisma.foodEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
      prisma.sleepEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
      prisma.trainingEntry.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
      prisma.bodyMeasurement.findMany({ select: { date: true }, orderBy: { date: 'desc' } }),
      prisma.foodEntry.findMany({ where: { date: { gte: sevenDaysAgo } }, select: { date: true, kcal: true } }),
      prisma.sleepEntry.findMany({ where: { date: { gte: sevenDaysAgo } }, select: { hours: true, quality: true } }),
      prisma.trainingEntry.findMany({ where: { date: { gte: sevenDaysAgo } }, select: { date: true, volume: true } }),
    ])

    const weekWeight = allWeightEntries.filter(e => e.date >= sevenDaysAgo)

    const totalModulesUsed = [
      allWeightEntries.length > 0,
      allFoodEntries.length > 0,
      allSleepEntries.length > 0,
      allTrainingEntries.length > 0,
      allMeasurements.length > 0,
    ].filter(Boolean).length

    const trainingCount = new Set(allTrainingEntries.map(e => e.date)).size

    const medals = computeMedals({
      weightDates:      allWeightEntries.map(e => e.date),
      foodDates:        allFoodEntries.map(e => e.date),
      sleepDates:       allSleepEntries.map(e => e.date),
      trainingDates:    allTrainingEntries.map(e => e.date),
      measurementDates: allMeasurements.map(e => e.date),
      weightEntries:    allWeightEntries,
      trainingCount,
      totalModulesUsed,
    })

    const weeklyWrap = buildWeeklyWrap(weekWeight, weekTraining, weekSleep, weekFood)
    const report     = buildReportToSelf(weekWeight, weekSleep, weekTraining, weekFood)

    return NextResponse.json({ medals, weeklyWrap, report })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load clubroom' }, { status: 500 })
  }
}
