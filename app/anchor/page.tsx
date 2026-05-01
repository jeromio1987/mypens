import { prisma } from '@/lib/db'
import { computeStreaks, todayStr, nextMilestone } from '@/lib/anchor/streaks'
import { computeMoneySaved } from '@/lib/anchor/money'
import AnchorClient from './AnchorClient'

export const dynamic = 'force-dynamic'

export default async function AnchorPage() {
  const today = todayStr()

  // Ensure settings row exists.
  let settings = await prisma.recoverySettings.findUnique({ where: { id: 'default' } })
  if (!settings) {
    settings = await prisma.recoverySettings.create({ data: { id: 'default' } })
  }

  const entries = await prisma.recoveryEntry.findMany({
    orderBy: { date: 'desc' },
    take: 400,
  })
  // Streak math expects ascending date order conceptually — the helper
  // walks backwards from `today` through a Map, so order in the array doesn't
  // matter. We keep it desc here for the recent-history strip below.

  const streaks = computeStreaks(entries, today)
  const money = computeMoneySaved(entries, settings, today)

  const todayEntry = entries.find(e => e.date === today) ?? null

  // Last 14 days of cravings — for the in-screen pattern strip.
  const cravings = await prisma.cravingEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const milestoneCompound = nextMilestone(streaks.compoundCleanDays)
  const milestoneAlcohol  = nextMilestone(streaks.alcoholFreeDays)

  const phaseDayNumber =
    settings.resetStartDate <= today ? streaks.compoundCleanDays : 0
  const phaseTotal = settings.phase1ResetDays
  const phaseProgress = Math.min(1, phaseDayNumber / phaseTotal)

  return (
    <AnchorClient
      today={today}
      settings={{
        drinkCostEur: settings.drinkCostEur,
        cocaineGramEur: settings.cocaineGramEur,
        escortNightEur: settings.escortNightEur,
        baselineDrinksPerWeek: settings.baselineDrinksPerWeek,
        baselineCocaineGramsPerMonth: settings.baselineCocaineGramsPerMonth,
        baselineEscortsPerMonth: settings.baselineEscortsPerMonth,
        resetStartDate: settings.resetStartDate,
        phase1ResetDays: settings.phase1ResetDays,
      }}
      streaks={streaks}
      money={money}
      todayEntry={
        todayEntry
          ? {
              date: todayEntry.date,
              alcoholDrinks: todayEntry.alcoholDrinks,
              cocaineUsed: todayEntry.cocaineUsed,
              escortUsed: todayEntry.escortUsed,
              mood: todayEntry.mood,
              energy: todayEntry.energy,
              sleepHours: todayEntry.sleepHours,
              supplements: safeJSONArray(todayEntry.supplements),
              notes: todayEntry.notes,
            }
          : null
      }
      recentEntries={entries.slice(0, 14).map(e => ({
        date: e.date,
        alcoholDrinks: e.alcoholDrinks,
        cocaineUsed: e.cocaineUsed,
        escortUsed: e.escortUsed,
      }))}
      recentCravings={cravings.map(c => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        target: c.target,
        action: c.action,
        outcome: c.outcome,
        trigger: c.trigger,
      }))}
      milestone={{
        compound: milestoneCompound,
        alcohol: milestoneAlcohol,
      }}
      phase={{
        dayNumber: phaseDayNumber,
        total: phaseTotal,
        progress: phaseProgress,
      }}
    />
  )
}

function safeJSONArray(s: string): string[] {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}
