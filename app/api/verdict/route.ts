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

// ── Mode weight: how seriously was the member supposed to be following protocol ──
function modeWeight(mode: string | null): number {
  if (mode === 'locked_in') return 1.5   // breach is worse — you committed
  if (mode === 'off')       return 0.4   // rest day — minor breach expected
  return 1.0                             // balanced — standard penalty
}

// ── Pillar comments ──────────────────────────────────────────────────────────
function pillarsComment(
  pillar: 'P' | 'E' | 'N' | 'S',
  score: number,
  ctx: Record<string, unknown>,
): string {
  const hasData = (ctx.hasEnoughData as boolean) ?? false
  if (!hasData) {
    const labels: Record<string, string> = {
      P: 'Training frequency is unknown — log your first session to establish a baseline.',
      E: 'No sleep or training data yet. Start tracking tonight.',
      N: 'No day entries yet. Log your mode each morning to unlock nutrition scoring.',
      S: 'No sleep records found. Log tonight to start building your sleep profile.',
    }
    return labels[pillar]
  }

  const todayMode = (ctx.todayMode as string | null) ?? null
  const offNote = todayMode === 'off' ? ' (Rest day — adjusted for recovery.)' : ''

  if (pillar === 'P') {
    const sessions = (ctx.trainingSessions as number) ?? 0
    if (score >= 80) return `Excellent execution. ${sessions} session${sessions !== 1 ? 's' : ''} this week — the protocol is working.`
    if (score >= 60) return `Solid effort. ${sessions} session${sessions !== 1 ? 's' : ''} logged. Keep the consistency.`
    if (score >= 40) return `Below capacity. ${sessions === 0 ? 'No sessions logged.' : `Only ${sessions} session${sessions !== 1 ? 's' : ''}.`}${offNote}`
    return `The gym missed you this week. Absence is a choice — just not a productive one.${offNote}`
  }
  if (pillar === 'E') {
    const sleepDays = (ctx.sleepDaysLogged as number) ?? 0
    const travelDays = (ctx.travelDays as number) ?? 0
    const travelNote = travelDays > 0 ? ` (${travelDays} travel day${travelDays > 1 ? 's' : ''} factored in.)` : ''
    if (score >= 80) return `Endurance foundation is solid. Sleep consistency at ${sleepDays}/7 nights is paying off.`
    if (score >= 60) return `Adequate. You could sustain a full week, but let's not push the luck we have just yet.`
    if (score >= 40) return `The baseline is shaky. Inconsistent sleep and low volume are compounding.${travelNote}`
    return `The engine is running on fumes. Prioritise recovery before you push harder.${travelNote}`
  }
  if (pillar === 'N') {
    const alcoholDays = (ctx.alcoholDays as number) ?? 0
    const heavyDays = (ctx.heavyMealDays as number) ?? 0
    const fuelledDays = (ctx.fuelledByTrainingDays as number) ?? 0
    const fuelNote = fuelledDays > 0 ? ` Heavy meals on training days aren't penalised — that's fuelling.` : ''
    if (score >= 80) return `Clean inputs this week. Mode discipline has translated into nutritional structure.`
    if (score >= 60) return `Reasonable.${alcoholDays > 0 ? ` ${alcoholDays > 1 ? `${alcoholDays} drinks` : 'One drink'} flagged.` : ''} Balance, Member.`
    if (score >= 40) return `${heavyDays > 0 ? `${heavyDays} heavy meal${heavyDays > 1 ? 's' : ''} logged. ` : ''}${alcoholDays > 0 ? `Alcohol on ${alcoholDays} day${alcoholDays > 1 ? 's' : ''}. ` : ''}${fuelNote} The inputs are visible in the outputs.`
    return `The nutrition ledger is alarming. This is a lifestyle audit, not a lifestyle choice.`
  }
  if (pillar === 'S') {
    const avgHours = (ctx.avgHours as number) ?? 0
    const travelDays = (ctx.travelDays as number) ?? 0
    const lateNightDays = (ctx.lateNightDays as number) ?? 0
    const disruptionNote = (travelDays + lateNightDays) > 0
      ? ` ${travelDays > 0 ? `Travel (${travelDays}d)` : ''}${travelDays > 0 && lateNightDays > 0 ? ' + ' : ''}${lateNightDays > 0 ? `late nights (${lateNightDays}d)` : ''} explain some disruption.`
      : ''
    if (score >= 80) return `${avgHours.toFixed(1)}h average. The recovery window is being respected. Well done.`
    if (score >= 60) return `${avgHours.toFixed(1)}h average is acceptable but there's margin. Aim for 7.5+.`
    if (score >= 40) return `${avgHours.toFixed(1)}h average.${disruptionNote} Push bedtime earlier.`
    return `${avgHours.toFixed(1)}h average is not rest — it's managed exhaustion.${disruptionNote} Put the phone down at 10 PM.`
  }
  return ''
}

// ── Headline ─────────────────────────────────────────────────────────────────
function buildHeadline(
  scores: { P: number; E: number; N: number; S: number },
  todayMode: string | null,
  hasEnoughData: boolean,
): string {
  if (!hasEnoughData) return 'Building your baseline.'

  if (todayMode === 'off') return 'Rest day filed. The body is the investment.'

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

// ── Auditor note ─────────────────────────────────────────────────────────────
function buildAuditorNote(
  scores: { P: number; E: number; N: number; S: number },
  ctx: Record<string, unknown>,
  todayMode: string | null,
  hasEnoughData: boolean,
): { quote: string; body: string } {
  if (!hasEnoughData) {
    return {
      quote: 'The ledger cannot be audited until entries exist.',
      body: 'Log your mode each morning, track sleep each night, and record at least one training session. The algorithm requires signal before it can speak. Start small — even one week of honest data changes the picture entirely.',
    }
  }

  if (todayMode === 'off') {
    return {
      quote: 'Recovery is not the absence of work. It is the most deliberate form of it.',
      body: 'You have selected Off mode today. Scores are read in recovery context — lower performance numbers are expected and appropriate. Use this window to repair, not regret.',
    }
  }

  const avg = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 4)
  const sessions  = (ctx.trainingSessions as number) ?? 0
  const sleepDays = (ctx.sleepDaysLogged as number) ?? 0

  if (avg >= 75) {
    return {
      quote: 'Consistency is the hallmark of the truly sophisticated. Variability is for the youth.',
      body: `We've noticed a pattern in your metrics. ${sessions} training session${sessions !== 1 ? 's' : ''} and ${sleepDays} night${sleepDays !== 1 ? 's' : ''} of tracked sleep. The compound effect of small, disciplined inputs is where your edge lives. Don't negotiate with it.`,
    }
  }
  if (avg >= 55) {
    return {
      quote: "Mediocrity is comfortable. That is precisely the problem.",
      body: `The numbers tell a story of potential not yet claimed. ${sessions < 2 ? 'Low training frequency this week.' : ''} ${sleepDays < 4 ? 'Sleep tracking has been inconsistent.' : ''} Pick one variable and dominate it before touching the rest.`,
    }
  }
  return {
    quote: 'Rock bottom is just a foundation with a better view.',
    body: `This is the data. Not a judgement — a map. ${sessions === 0 ? 'No training sessions logged this week. ' : ''}${sleepDays < 3 ? 'Sleep records are sparse. ' : ''}The audit begins with acknowledgment. Start there.`,
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface VerdictPillar {
  key: 'P' | 'E' | 'N' | 'S'
  label: string
  score: number
  comment: string
  icon: string
  hasData: boolean
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
  todayMode: string | null
  hasEnoughData: boolean
  modeNote: string | null
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const cutoff7  = dateNDaysAgo(7)
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

    // ── Derived signals ───────────────────────────────────────────────────────

    const trainDates    = [...new Set(trainEntries.map(e => e.date))]
    const trainSessions = trainDates.length
    const weekVolume    = trainEntries.reduce((s, e) => s + e.volume, 0)

    const sleepDaysLogged = sleepEntries.length
    const avgHours  = sleepDaysLogged > 0
      ? sleepEntries.reduce((s, e) => s + e.hours, 0) / sleepDaysLogged
      : 0
    const avgQuality = sleepDaysLogged > 0
      ? sleepEntries.reduce((s, e) => s + e.quality, 0) / sleepDaysLogged
      : 0

    const parsedDays = dayEntries.map(e => ({
      date: e.date,
      mode: e.mode,
      tags: JSON.parse(e.tags) as string[],
    }))

    // Today's intent
    const todayEntry = parsedDays.find(d => d.date === todayStr) ?? null
    const todayMode  = todayEntry?.mode ?? null

    // Context tag tallies
    const lockedInDays  = parsedDays.filter(d => d.mode === 'locked_in').length
    const travelDays    = parsedDays.filter(d => d.tags.includes('travel')).length
    const lateNightDays = parsedDays.filter(d => d.tags.includes('late_night')).length

    // Mode-weighted alcohol + heavy meal penalties
    // heavy_meal on a day also tagged intense_training is NOT penalised (fuelling)
    let alcoholPenalty  = 0
    let alcoholDaysCount = 0
    let heavyMealPenalty = 0
    let heavyMealDaysCount = 0
    let fuelledByTrainingDays = 0

    for (const d of parsedDays) {
      const w = modeWeight(d.mode)
      if (d.tags.includes('alcohol')) {
        alcoholPenalty += 15 * w
        alcoholDaysCount++
      }
      if (d.tags.includes('heavy_meal')) {
        if (d.tags.includes('intense_training')) {
          fuelledByTrainingDays++  // exempt — this is fuelling
        } else {
          heavyMealPenalty += 10 * w
          heavyMealDaysCount++
        }
      }
    }

    // ── Data sufficiency ──────────────────────────────────────────────────────
    // Need at least 2 meaningful signals to produce credible scores
    const totalSignals = trainSessions + sleepDaysLogged + parsedDays.length
    const hasEnoughData = totalSignals >= 2

    // ── Scores — activity-derived, no arbitrary base ──────────────────────────

    // PERFORMANCE: 0–99, entirely from training activity
    // 5 sessions = full score territory; locked_in discipline adds bonus
    const perfTraining  = Math.min((trainSessions / 5) * 65, 65)
    const perfDiscipline = Math.min(lockedInDays * 5, 25)
    const perfIntense   = parsedDays.some(d => d.tags.includes('intense_training')) ? 9 : 0
    const scoreP = hasEnoughData ? clamp(perfTraining + perfDiscipline + perfIntense) : 0

    // ENDURANCE: sleep consistency + avg hours + training frequency
    const enduSleep    = sleepDaysLogged > 0 ? (sleepDaysLogged / 7) * 40 : 0
    const enduHours    = avgHours > 0 ? Math.min(((avgHours - 4) / 4) * 40, 40) : 0
    const enduTrain    = Math.min(trainSessions * 3, 18)
    const scoreE = hasEnoughData ? clamp(enduSleep + enduHours + enduTrain) : 0

    // NUTRITION: starts from 70, deduct mode-weighted penalties, add locked_in bonus
    const nutrBase     = 70
    const nutrBonus    = Math.min(lockedInDays * 3, 15)
    const scoreN = hasEnoughData
      ? clamp(nutrBase + nutrBonus - alcoholPenalty - heavyMealPenalty)
      : 0

    // SLEEP: hours quality + tracking consistency + disruption excuse
    const sleepHourBase    = avgHours > 0 ? Math.min(((avgHours - 4) / 4) * 55, 55) : 0
    const sleepQualBase    = sleepDaysLogged > 0 ? Math.min((avgQuality / 5) * 30, 30) : 0
    const sleepLogBonus    = Math.min((sleepDaysLogged / 7) * 14, 14)
    // Travel/late-night excuse: reduces effective penalty on below-average nights
    const disruptionRatio  = Math.min((travelDays + lateNightDays) / Math.max(sleepDaysLogged, 1), 0.6)
    const rawSleep         = sleepHourBase + sleepQualBase + sleepLogBonus
    const disruptionCredit = rawSleep < 55 ? (55 - rawSleep) * disruptionRatio * 0.35 : 0
    const scoreS = hasEnoughData ? clamp(rawSleep + disruptionCredit) : 0

    const scores = { P: scoreP, E: scoreE, N: scoreN, S: scoreS }

    const ctx = {
      trainingSessions: trainSessions,
      sleepDaysLogged,
      avgHours,
      alcoholDays: alcoholDaysCount,
      heavyMealDays: heavyMealDaysCount,
      fuelledByTrainingDays,
      travelDays,
      lateNightDays,
      todayMode,
      hasEnoughData,
    }

    const pillars: VerdictPillar[] = [
      { key: 'P', label: 'Performance', score: scoreP, comment: pillarsComment('P', scoreP, ctx), icon: 'arrow-up-right', hasData: trainSessions > 0 },
      { key: 'E', label: 'Endurance',   score: scoreE, comment: pillarsComment('E', scoreE, ctx), icon: 'activity',       hasData: sleepDaysLogged > 0 || trainSessions > 0 },
      { key: 'N', label: 'Nutrition',   score: scoreN, comment: pillarsComment('N', scoreN, ctx), icon: 'utensils',       hasData: parsedDays.length > 0 },
      { key: 'S', label: 'Sleep',       score: scoreS, comment: pillarsComment('S', scoreS, ctx), icon: 'moon',           hasData: sleepDaysLogged > 0 },
    ]

    // ── Ledger ────────────────────────────────────────────────────────────────

    const ledger: LedgerItem[] = []

    for (const date of trainDates.slice(0, 3)) {
      const sets  = trainEntries.filter(e => e.date === date)
      const vol   = sets.reduce((s, e) => s + e.volume, 0)
      const topEx = sets.sort((a, b) => b.volume - a.volume)[0]?.exercise ?? 'Session'
      const pts   = Math.min(Math.round(vol / 80), 20) || 8
      ledger.push({
        date: formatDate(date),
        label: topEx.length > 22 ? topEx.slice(0, 22) + '…' : topEx,
        points: pts,
        pillar: 'PERF',
        detail: `${sets.length} exercise${sets.length !== 1 ? 's' : ''} · ${Math.round(vol)} kg volume`,
      })
    }

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

    for (const d of parsedDays.filter(d => d.tags.includes('alcohol') || d.tags.includes('heavy_meal')).slice(0, 2)) {
      const hasAlc   = d.tags.includes('alcohol')
      const hasHeavy = d.tags.includes('heavy_meal')
      const isFuelled = d.tags.includes('intense_training')
      const w = modeWeight(d.mode)
      const rawPts = -(hasAlc ? Math.round(15 * w) : 0) - (!isFuelled && hasHeavy ? Math.round(10 * w) : 0)
      if (rawPts !== 0) {
        ledger.push({
          date: formatDate(d.date),
          label: [hasAlc ? 'Alcohol' : null, hasHeavy ? (isFuelled ? 'Heavy meal (fuelling)' : 'Heavy meal') : null].filter(Boolean).join(' + ') ?? 'Context',
          points: rawPts,
          pillar: 'NUTR',
          detail: `Mode: ${d.mode?.replace('_', ' ') ?? 'none'} · Penalty ×${w.toFixed(1)}`,
        })
      }
    }

    ledger.sort((a, b) => Math.abs(b.points) - Math.abs(a.points))

    // ── Mode note for UI ──────────────────────────────────────────────────────
    let modeNote: string | null = null
    if (todayMode === 'off') {
      modeNote = "Today is a Rest Day. Scores reflect recovery context — reduced performance output is expected and appropriate."
    } else if (todayMode === 'locked_in') {
      modeNote = "Today is a Locked In day. Full protocol active — any deviations are scored at full weight."
    } else if (todayMode === 'balanced') {
      modeNote = "Today is a Balanced day. Standard scoring applies with normal penalty thresholds."
    }

    const weekRange = `${formatDate(cutoff7)} — ${formatDate(todayStr)}`

    return NextResponse.json({
      headline:     buildHeadline(scores, todayMode, hasEnoughData),
      pillars,
      ledger:       ledger.slice(0, 6),
      auditorNote:  buildAuditorNote(scores, ctx, todayMode, hasEnoughData),
      weekRange,
      todayMode,
      hasEnoughData,
      modeNote,
    } satisfies VerdictData)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to compute verdict' }, { status: 500 })
  }
}
