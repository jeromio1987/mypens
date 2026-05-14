import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getStaticMacroEventsInRange } from '@/lib/investing/macroStaticDates'

export const dynamic = 'force-dynamic'

function qualityLabel(q: number): string {
  if (q >= 5) return 'Perfect'
  if (q >= 4) return 'Solid'
  if (q >= 3) return 'Adequate'
  if (q >= 2) return 'Poor'
  return 'Very poor'
}

function sleepVerdict(hours: number, quality: number, hrv: number | null): string {
  if (hours >= 7.5 && quality >= 4) return hrv && hrv > 50 ? 'Full recovery. Go.' : 'Strong night.'
  if (hours >= 6.5 && quality >= 3) return 'Adequate. Manage output accordingly.'
  if (hours < 6) return 'Short night. Keep decision stakes low.'
  return 'Disrupted sleep. Account for it.'
}

function modeVerdict(mode: string | null): string {
  if (mode === 'locked_in') return 'Optimise — everything tracked, performance focus.'
  if (mode === 'balanced') return 'Maintain — sustainable output, no pressure.'
  if (mode === 'off') return 'Rest or reset — no friction, recovery counts.'
  return 'No mode set yet today.'
}

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const yd = new Date()
    yd.setDate(yd.getDate() - 1)
    const yesterday = yd.toISOString().split('T')[0]

    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 14)
    const horizonStr = horizon.toISOString().split('T')[0]

    let latestRegime: { regime: string; effectiveDate: string } | null = null
    let watchTickers: { symbol: string }[] = []
    let manualCal: { date: string; title: string; kind: string }[] = []

    try {
      ;[latestRegime, watchTickers, manualCal] = await Promise.all([
        prisma.macroRegimeSnapshot.findFirst({
          orderBy: { effectiveDate: 'desc' },
          select: { regime: true, effectiveDate: true },
        }),
        prisma.investingWatchlistTicker.findMany({ orderBy: { sortOrder: 'asc' }, take: 24 }),
        prisma.investingManualEvent.findMany({
          where: { date: { gte: today, lte: horizonStr } },
          orderBy: { date: 'asc' },
          take: 20,
        }),
      ])
    } catch {
      // Until migration `20260514142000_investing_hub` is applied.
    }

    const staticMacro = getStaticMacroEventsInRange(today, horizonStr)
    const upcomingInvesting = [
      ...staticMacro.map(e => ({ date: e.date, title: e.title, kind: e.kind, source: 'static' as const })),
      ...manualCal.map(m => ({
        date: m.date,
        title: m.title,
        kind: m.kind,
        source: 'manual' as const,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))

    const [sleepEntries, weightEntries, journalEntry, dayEntry] = await Promise.all([
      prisma.sleepEntry.findMany({ orderBy: { date: 'desc' }, take: 2 }),
      prisma.weightEntry.findMany({ orderBy: { date: 'desc' }, take: 7 }),
      prisma.journalEntry.findFirst({ orderBy: { date: 'desc' } }),
      prisma.dayEntry.findUnique({ where: { date: today } }),
    ])

    const sleep =
      sleepEntries.find(e => e.date === today || e.date === yesterday) ??
      sleepEntries[0] ??
      null

    const latestWeight = weightEntries[0] ?? null
    const avgTrueWeight =
      weightEntries.length > 0
        ? weightEntries.reduce((s, e) => s + e.trueWeightKg, 0) / weightEntries.length
        : null

    let anchorStreak = 0
    try {
      const recentRecovery = await prisma.recoveryEntry.findMany({
        orderBy: { date: 'desc' },
        take: 60,
      })
      for (const entry of recentRecovery) {
        if (entry.alcoholDrinks === 0 && !entry.cocaineUsed && !entry.escortUsed) {
          anchorStreak++
        } else {
          break
        }
      }
    } catch {
      // Anchor table may not exist yet — non-fatal
    }

    type Priority = { rank: number; label: string; hint: string; module: string }
    const priorities: Priority[] = []

    if (sleep && sleep.hours < 6.5) {
      priorities.push({
        rank: 1,
        label: 'Protect sleep debt',
        hint: sleepVerdict(sleep.hours, sleep.quality, sleep.hrv ?? null),
        module: 'sleep',
      })
    }
    if (latestWeight && avgTrueWeight != null && Math.abs(latestWeight.trueWeightKg - avgTrueWeight) > 0.35) {
      const dir = latestWeight.trueWeightKg > avgTrueWeight ? 'above' : 'below'
      priorities.push({
        rank: priorities.length + 1,
        label: 'True weight vs 7-day mean',
        hint: `Latest true weight is ${dir} your rolling mean — check sodium, training, and scale timing before changing calories.`,
        module: 'weight',
      })
    }
    if (dayEntry?.mode === 'locked_in' && (!sleep || sleep.quality < 3)) {
      priorities.push({
        rank: priorities.length + 1,
        label: 'Mode vs recovery',
        hint: 'Locked-in mode with mediocre sleep — bias toward maintenance and technique, not new PRs.',
        module: 'mode',
      })
    }
    if (latestRegime?.regime === 'risk_off' || latestRegime?.regime === 'defensive') {
      priorities.push({
        rank: priorities.length + 1,
        label: 'Portfolio regime',
        hint: `Macro regime is ${latestRegime?.regime ?? 'unset'} — size risk deliberately; calendar events below matter more.`,
        module: 'investing',
      })
    }
    if (priorities.length === 0 && (sleep || latestWeight)) {
      priorities.push({
        rank: 1,
        label: 'Steady state',
        hint: 'No red flags in the quick scan — keep logging; consistency beats intensity.',
        module: 'general',
      })
    }

    const narrativeParts: string[] = []
    if (sleep) {
      narrativeParts.push(`Sleep: ${sleepVerdict(sleep.hours, sleep.quality, sleep.hrv ?? null)}`)
    }
    if (latestWeight && avgTrueWeight != null) {
      const d = Math.round((latestWeight.trueWeightKg - avgTrueWeight) * 10) / 10
      narrativeParts.push(
        `Weight: true weight ${latestWeight.trueWeightKg} kg (${d >= 0 ? '+' : ''}${d} kg vs 7d mean).`,
      )
    }
    narrativeParts.push(modeVerdict(dayEntry?.mode ?? null))
    if (latestRegime?.regime) {
      narrativeParts.push(`Investing regime: ${latestRegime.regime} (since ${latestRegime.effectiveDate}).`)
    }
    const narrative = narrativeParts.join(' ')

    return NextResponse.json({
      date: today,

      narrative,
      priorities: priorities.slice(0, 6),

      sleep: sleep
        ? {
            date: sleep.date,
            hours: sleep.hours,
            quality: sleep.quality,
            hrv: sleep.hrv ?? null,
            bedtime: sleep.bedtime,
            wakeTime: sleep.wakeTime,
            qualityLabel: qualityLabel(sleep.quality),
            verdict: sleepVerdict(sleep.hours, sleep.quality, sleep.hrv ?? null),
          }
        : null,

      weight: latestWeight
        ? {
            date: latestWeight.date,
            scaleKg: latestWeight.scaleKg,
            trueWeightKg: latestWeight.trueWeightKg,
            bodyFatPct: latestWeight.bodyFatPct ?? null,
            avgTrueWeight7d: avgTrueWeight ? Math.round(avgTrueWeight * 10) / 10 : null,
            deltaKg:
              avgTrueWeight != null
                ? Math.round((latestWeight.trueWeightKg - avgTrueWeight) * 10) / 10
                : null,
          }
        : null,

      mode: {
        value: dayEntry?.mode ?? null,
        tags: dayEntry?.tags ? (JSON.parse(dayEntry.tags) as string[]) : [],
        verdict: modeVerdict(dayEntry?.mode ?? null),
      },

      journal: journalEntry
        ? {
            date: journalEntry.date,
            title: journalEntry.title ?? null,
            mood: journalEntry.mood ?? null,
            preview:
              journalEntry.content.length > 120
                ? journalEntry.content.slice(0, 120) + '…'
                : journalEntry.content,
          }
        : null,

      anchor: { streak: anchorStreak },

      investing: {
        regime: latestRegime?.regime ?? null,
        effectiveDate: latestRegime?.effectiveDate ?? null,
        watchlist: watchTickers.map(w => w.symbol),
        upcoming: upcomingInvesting.slice(0, 8),
      },
    })
  } catch (error) {
    console.error('[morning-brief]', error)
    return NextResponse.json({ error: 'Failed to load brief' }, { status: 500 })
  }
}
