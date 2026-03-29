import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateNDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function clamp(v: number, min = 0, max = 99): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function pillarsComment(pillar: 'P' | 'E' | 'N' | 'S', score: number, ctx: Record<string, unknown>): string {
  if (pillar === 'P') {
    const sessions = (ctx.trainingSessions as number) ?? 0
    if (score >= 80) return `Excellent execution. ${sessions} session${sessions !== 1 ? 's' : ''} this week — the protocol is working.`
    if (score >= 60) return `Solid effort. ${sessions} session${sessions !== 1 ? 's' : ''} logged. Keep the consistency.`
    if (score >= 40) return `Respectable but you're leaving performance on the table. Get back in the room.`
    return `The gym missed you this week. Absence is a choice — just not a productive one.`
  }
  if (pillar === 'E') {
    const sleepDays = (ctx.sleepDaysLogged as number) ?? 0
    if (score >= 80) return `Endurance foundation is solid. Sleep consistency at ${sleepDays}/7 nights is paying off.`
    if (score >= 60) return `Adequate. You could sustain a full week, but let's not push the luck we have just yet.`
    if (score >= 40) return `The baseline is shaky. Inconsistent sleep and low volume are compounding.`
    return `The engine is running on fumes. Prioritise recovery before you push harder.`
  }
  if (pillar === 'N') {
    const alcoholDays = (ctx.alcoholDays as number) ?? 0
    const heavyDays = (ctx.heavyMealDays as number) ?? 0
    if (score >= 80) return `Clean inputs this week. Mode discipline has translated into nutritional structure.`
    if (score >= 60) return `Reasonable. The ridge was a cliché${alcoholDays > 0 ? `, the ${alcoholDays > 1 ? 'drinks were' : 'drink was'} a choice` : ''}. Balance, Member.`
    if (score >= 40) return `${heavyDays > 0 ? `${heavyDays} heavy meal${heavyDays > 1 ? 's' : ''} logged. ` : ''}${alcoholDays > 0 ? `Alcohol on ${alcoholDays} day${alcoholDays > 1 ? 's' : ''}. ` : ''}The inputs are visible in the outputs.`
    return `The nutrition ledger is alarming. This is a lifestyle audit, not a lifestyle choice.`
  }
  if (pillar === 'S') {
    const avgHours = (ctx.avgHours as number) ?? 0
    if (score >= 80) return `${avgHours.toFixed(1)}h average. The recovery window is being respected. Well done.`
    if (score >= 60) return `${avgHours.toFixed(1)}h average is acceptable but there's margin. Aim for 7.5+.`
    if (score >= 40) return `${avgHours.toFixed(1)}h average. The body adapts, the mind does not. Push bedtime earlier.`
    return `Catastrophic. ${avgHours.toFixed(1)}h average is not rest — it's managed exhaustion. Put the phone down at 10 PM.`
  }
  return ''
}

function buildHeadline(scores: { P: number; E: number; N: number; S: number }): string {
  const worst = Object.entries(scores).sort((a, b) => a[1] - b[1])[0]
  const best  = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  if (worst[1] < 35) {
    const labels: Record<string, string> = { P: 'performance', E: 'endurance', N: 'nutrition', S: 'sleep' }
    return `Your ${labels[worst[0]]} was abysmal.`
  }
  if (Math.min(...Object.values(scores)) >= 70) return `A clean week, Member. Build on it.`
  if (best[1] >= 80) {
    const labels: Record<string, string> = { P: 'training', E: 'endurance', N: 'nutrition', S: 'sleep' }
    return `Strong ${labels[best[0]]}. Hold the standard.`
  }
  return `The baseline is set. Now raise it.`
}

function buildAuditorNote(scores: { P: number; E: number; N: number; S: number }, ctx: Record<string, unknown>): { quote: string; body: string } {
  const avg = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 4)
  const sleepDays = (ctx.sleepDaysLogged as number) ?? 0
  const sessions  = (ctx.trainingSessions as number) ?? 0

  if (avg >= 75) {
    return {
      quote: 'Consistency is the hallmark of the truly sophisticated. Variability is for the youth.',
      body: `We've noticed a pattern in your metrics. ${sessions} training sessions and ${sleepDays} nights of tracked sleep. The compound effect of small, disciplined inputs is where your edge lives. Don't negotiate with it.`,
    }
  }
  if (avg >= 55) {
    return {
      quote: "Mediocrity is comfortable. That's precisely the problem.",
      body: `The numbers tell a story of potential not yet claimed. ${sessions < 2 ? 'Low training frequency this week.' : ''} ${sleepDays < 4 ? 'Sleep tracking has been inconsistent.' : ''} Pick one variable and dominate it before touching the rest.`,
    }
  }
  return {
    quote: 'Rock bottom is just a foundation with a better view.',
    body: `This is the data. Not a judgement — a map. ${sessions === 0 ? 'No training sessions logged this week. ' : ''}${sleepDays < 3 ? 'Sleep records are sparse. ' : ''}The audit begins with acknowledgment. Start there.`,
  }
}

export interface VerdictPillar {
  key: 'P' | 'E' | 'N' | 'S'
  label: string
  score: number
  comment: string
  icon: string
}

export interface LedgerItem {
  date: string
  label: string
  points: number
  pillar: 'PERF' | 'ENDU' | 'NUTR' | 'SLEP'
  detail: string
}

export interface VerdictData {
  headline: string
  pillars: VerdictPillar[]
  ledger: LedgerItem[]
  auditorNote: { quote: string; body: string }
  weekRange: string
}

export async function GET() {
  try {
    const cutoff7  = dateNDaysAgo(7)
    const cutoff14 = dateNDaysAgo(14)
    const todayStr = today()

    const [trainEntries, sleepEntries, dayEntries] = await Promise.all([
      prisma.trainingEntry.findMany({
        where: { date: { gte: cutoff7 } },
        orderBy: { date: 'desc' },
      }),
      prisma.sleepEntry.findMany({
        where: { date: { gte: cutoff7 } },
        orderBy: { date: 'desc' },
      }),
      prisma.dayEntry.findMany({
        where: { date: { gte: cutoff7 } },
        orderBy: { date: 'desc' },
      }),
    ])

    // ── Derived ──────────────────────────────────────────────────────────────

    // Training
    const trainDates    = [...new Set(trainEntries.map(e => e.date))]
    const trainSessions = trainDates.length
    const weekVolume    = trainEntries.reduce((s, e) => s + e.volume, 0)

    // Sleep
    const sleepDaysLogged = sleepEntries.length
    const avgHours  = sleepDaysLogged > 0
      ? sleepEntries.reduce((s, e) => s + e.hours, 0) / sleepDaysLogged
      : 0
    const avgQuality = sleepDaysLogged > 0
      ? sleepEntries.reduce((s, e) => s + e.quality, 0) / sleepDaysLogged
      : 0

    // Day entries
    const parsedDays = dayEntries.map(e => ({
      date: e.date,
      mode: e.mode,
      tags: JSON.parse(e.tags) as string[],
    }))
    const lockedInDays  = parsedDays.filter(d => d.mode === 'locked_in').length
    const offDays       = parsedDays.filter(d => d.mode === 'off').length
    const alcoholDays   = parsedDays.filter(d => d.tags.includes('alcohol')).length
    const heavyMealDays = parsedDays.filter(d => d.tags.includes('heavy_meal')).length

    // ── Scores ────────────────────────────────────────────────────────────────

    const scoreP = clamp(
      40
      + Math.min(trainSessions * 10, 40)
      + Math.min(lockedInDays * 5, 15)
      - (trainDates.length === 0 ? 8 : 0)
    )

    const scoreE = clamp(
      35
      + Math.min(sleepDaysLogged * 5, 35)
      + Math.min(trainSessions * 6, 24)
      + (avgHours >= 7 ? 6 : 0)
    )

    const scoreN = clamp(
      65
      + Math.min(lockedInDays * 4, 16)
      - Math.min(alcoholDays * 12, 36)
      - Math.min(heavyMealDays * 8, 24)
      - Math.min(offDays * 3, 12)
    )

    const sleepHourPoints  = avgHours > 0 ? Math.min(((avgHours - 4) / 5) * 50, 50) : 0
    const sleepQualPoints  = Math.min(avgQuality * 6, 30)
    const scoreS = clamp(10 + sleepHourPoints + sleepQualPoints)

    const scores = { P: scoreP, E: scoreE, N: scoreN, S: scoreS }

    const ctx = { trainingSessions: trainSessions, sleepDaysLogged, avgHours, alcoholDays, heavyMealDays }

    const pillars: VerdictPillar[] = [
      { key: 'P', label: 'Performance', score: scoreP, comment: pillarsComment('P', scoreP, ctx), icon: 'arrow-up-right' },
      { key: 'E', label: 'Endurance',   score: scoreE, comment: pillarsComment('E', scoreE, ctx), icon: 'activity'      },
      { key: 'N', label: 'Nutrition',   score: scoreN, comment: pillarsComment('N', scoreN, ctx), icon: 'utensils'      },
      { key: 'S', label: 'Sleep',       score: scoreS, comment: pillarsComment('S', scoreS, ctx), icon: 'moon'          },
    ]

    // ── Ledger ────────────────────────────────────────────────────────────────

    const ledger: LedgerItem[] = []

    // Training sessions → PERF + ENDU
    for (const date of trainDates.slice(0, 3)) {
      const sets   = trainEntries.filter(e => e.date === date)
      const vol    = sets.reduce((s, e) => s + e.volume, 0)
      const topEx  = sets.sort((a, b) => b.volume - a.volume)[0]?.exercise ?? 'Session'
      const pts    = Math.min(Math.round(vol / 80), 20) || 8
      ledger.push({
        date: formatDate(date),
        label: topEx.length > 22 ? topEx.slice(0, 22) + '…' : topEx,
        points: pts,
        pillar: 'PERF',
        detail: `${sets.length} exercise${sets.length !== 1 ? 's' : ''} · ${Math.round(vol)} kg volume`,
      })
    }

    // Sleep entries → SLEP
    for (const s of sleepEntries.slice(0, 3)) {
      const pts = s.hours >= 7.5 ? Math.round((s.hours - 5) * 4) : -Math.round((7 - s.hours) * 6)
      ledger.push({
        date: formatDate(s.date),
        label: `${s.hours.toFixed(1)}h — quality ${s.quality}/5`,
        points: pts,
        pillar: 'SLEP',
        detail: `${s.bedtime} → ${s.wakeTime}${s.hrv ? ` · HRV ${s.hrv} ms` : ''}`,
      })
    }

    // Context tag entries → NUTR
    for (const d of parsedDays.filter(d => d.tags.includes('alcohol') || d.tags.includes('heavy_meal')).slice(0, 2)) {
      const hasAlc  = d.tags.includes('alcohol')
      const hasHeavy = d.tags.includes('heavy_meal')
      ledger.push({
        date: formatDate(d.date),
        label: [hasAlc ? 'Alcohol' : null, hasHeavy ? 'Heavy meal' : null].filter(Boolean).join(' + ') ?? 'Context',
        points: -(hasAlc ? 12 : 0) - (hasHeavy ? 8 : 0),
        pillar: 'NUTR',
        detail: `Day mode: ${d.mode?.replace('_', ' ') ?? '—'}`,
      })
    }

    // Sort ledger by absolute impact descending
    ledger.sort((a, b) => Math.abs(b.points) - Math.abs(a.points))

    const weekRange = `${formatDate(cutoff7)} — ${formatDate(todayStr)}`

    return NextResponse.json({
      headline:    buildHeadline(scores),
      pillars,
      ledger:      ledger.slice(0, 6),
      auditorNote: buildAuditorNote(scores, ctx),
      weekRange,
    } satisfies VerdictData)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to compute verdict' }, { status: 500 })
  }
}
