import { prisma } from '@/lib/db'
import { rollingWindow, windowWhere } from '@/lib/timeWindow'
import { buildCockpitWindow } from '@/lib/engines/cockpitData'
import { auditorInsufficient } from '@/lib/auditorTone'

/** Soft nutrition targets until WP 2.3 phase goals exist. */
const SOFT_KCAL_TARGET = 2000
const SOFT_PROTEIN_TARGET = 150

/** Pillar scores are 0–100 inclusive (P1: document the ceiling). */
function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}

/** Minimum logged days of a pillar's own input before a score may appear (P2). */
const PILLAR_COVERAGE_MIN = 4

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
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
  score: number | null,
  ctx: Record<string, unknown>,
): string {
  const pillarHasData = (ctx[`hasData${pillar}`] as boolean) ?? false
  if (!pillarHasData) {
    const labels: Record<string, string> = {
      P: `Need ${PILLAR_COVERAGE_MIN}+ training days in this window before Performance scores.`,
      E: `Endurance needs ${PILLAR_COVERAGE_MIN}+ sleep nights and at least one training day — sleep alone is not enough.`,
      N: auditorInsufficient('Nutrition', `fewer than ${PILLAR_COVERAGE_MIN} food-logged days`),
      S: `Need ${PILLAR_COVERAGE_MIN}+ nights with measured sleep quality before Sleep scores.`,
    }
    return labels[pillar]
  }

  const todayMode = (ctx.todayMode as string | null) ?? null
  const offNote = todayMode === 'off' ? ' (Rest day — adjusted for recovery.)' : ''
  const windowDays = (ctx.windowDays as number) ?? 7

  if (pillar === 'P') {
    const sessions = (ctx.trainingSessions as number) ?? 0
    if (score != null && score >= 80) return `Excellent execution. ${sessions} session${sessions !== 1 ? 's' : ''} this week — the protocol is working.`
    if (score != null && score >= 60) return `Solid effort. ${sessions} session${sessions !== 1 ? 's' : ''} logged. Keep the consistency.`
    if (score != null && score >= 40) return `Below capacity. ${sessions === 0 ? 'No sessions logged.' : `Only ${sessions} session${sessions !== 1 ? 's' : ''}.`}${offNote}`
    return `The gym missed you this week. Absence is a choice — just not a productive one.${offNote}`
  }
  if (pillar === 'E') {
    const sleepDays = (ctx.sleepDaysLogged as number) ?? 0
    const travelDays = (ctx.travelDays as number) ?? 0
    const travelNote = travelDays > 0 ? ` (${travelDays} travel day${travelDays > 1 ? 's' : ''} factored in.)` : ''
    if (score != null && score >= 80) return `Endurance foundation is solid. Sleep consistency at ${sleepDays}/${windowDays} nights is paying off.`
    if (score != null && score >= 60) return `Adequate. You could sustain a full week, but let's not push the luck we have just yet.`
    if (score != null && score >= 40) return `The baseline is shaky. Inconsistent sleep and low volume are compounding.${travelNote}`
    return `The engine is running on fumes. Prioritise recovery before you push harder.${travelNote}`
  }
  if (pillar === 'N') {
    const alcoholDays = (ctx.alcoholDays as number) ?? 0
    const heavyDays = (ctx.heavyMealDays as number) ?? 0
    const fuelledDays = (ctx.fuelledByTrainingDays as number) ?? 0
    const fuelNote = fuelledDays > 0 ? ` Heavy meals on training days aren't penalised — that's fuelling.` : ''
    if (score != null && score >= 80) return `Clean inputs this week. Mode discipline has translated into nutritional structure.`
    if (score != null && score >= 60) return `Reasonable.${alcoholDays > 0 ? ` ${alcoholDays > 1 ? `${alcoholDays} drinks` : 'One drink'} flagged.` : ''} Balance, Member.`
    if (score != null && score >= 40) return `${heavyDays > 0 ? `${heavyDays} heavy meal${heavyDays > 1 ? 's' : ''} logged. ` : ''}${alcoholDays > 0 ? `Alcohol on ${alcoholDays} day${alcoholDays > 1 ? 's' : ''}. ` : ''}${fuelNote} The inputs are visible in the outputs.`
    return `The nutrition ledger is alarming. This is a lifestyle audit, not a lifestyle choice.`
  }
  if (pillar === 'S') {
    const avgHours = (ctx.avgHours as number) ?? 0
    const travelDays = (ctx.travelDays as number) ?? 0
    const lateNightDays = (ctx.lateNightDays as number) ?? 0
    const disruptionNote = (travelDays + lateNightDays) > 0
      ? ` ${travelDays > 0 ? `Travel (${travelDays}d)` : ''}${travelDays > 0 && lateNightDays > 0 ? ' + ' : ''}${lateNightDays > 0 ? `late nights (${lateNightDays}d)` : ''} explain some disruption.`
      : ''
    if (score != null && score >= 80) return `${avgHours.toFixed(1)}h average. The recovery window is being respected. Well done.`
    if (score != null && score >= 60) return `${avgHours.toFixed(1)}h average is acceptable but there's margin. Aim for 7.5+.`
    if (score != null && score >= 40) return `${avgHours.toFixed(1)}h average.${disruptionNote} Push bedtime earlier.`
    return `${avgHours.toFixed(1)}h average is not rest — it's managed exhaustion.${disruptionNote} Put the phone down at 10 PM.`
  }
  return ''
}

// ── Headline ─────────────────────────────────────────────────────────────────
function buildHeadline(
  scores: { P: number | null; E: number | null; N: number | null; S: number | null },
  todayMode: string | null,
  anyPillarReady: boolean,
): string {
  if (!anyPillarReady) return 'Building your baseline.'

  if (todayMode === 'off') return 'Rest day filed. The body is the investment.'

  const present = Object.entries(scores).filter(([, v]) => v != null) as [string, number][]
  if (present.length === 0) return 'Building your baseline.'

  const worst = present.sort((a, b) => a[1] - b[1])[0]
  const best  = [...present].sort((a, b) => b[1] - a[1])[0]
  if (worst[1] < 35) {
    const labels: Record<string, string> = { P: 'performance', E: 'endurance', N: 'nutrition', S: 'sleep' }
    return `Your ${labels[worst[0]]} was abysmal.`
  }
  if (present.length >= 3 && Math.min(...present.map(([, v]) => v)) >= 70) {
    return `A clean week, Member. Build on it.`
  }
  if (best[1] >= 80) {
    const labels: Record<string, string> = { P: 'training', E: 'endurance', N: 'nutrition', S: 'sleep' }
    return `Strong ${labels[best[0]]}. Hold the standard.`
  }
  return `The baseline is set. Now raise it.`
}

// ── Auditor note ─────────────────────────────────────────────────────────────
function buildAuditorNote(
  scores: { P: number | null; E: number | null; N: number | null; S: number | null },
  ctx: Record<string, unknown>,
  todayMode: string | null,
  anyPillarReady: boolean,
): { quote: string; body: string } {
  if (!anyPillarReady) {
    return {
      quote: 'The ledger cannot be audited until entries exist.',
      body: `Log your mode each morning, track sleep each night, and record training. Each pillar needs at least ${PILLAR_COVERAGE_MIN} days of its own input before it scores.`,
    }
  }

  if (todayMode === 'off') {
    return {
      quote: 'Recovery is not the absence of work. It is the most deliberate form of it.',
      body: 'You have selected Off mode today. Scores are read in recovery context — lower performance numbers are expected and appropriate. Use this window to repair, not regret.',
    }
  }

  const present = Object.values(scores).filter((v): v is number => v != null)
  const avg = present.length > 0
    ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
    : 0
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
  /** null when coverage is insufficient (P2) — UI must not invent a number. */
  score: number | null
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
  /** P9 — every number on this payload is computed inside this window. */
  window: {
    label: 'rolling'
    from: string
    to: string
    days: number
  }
}

/** Compute the rolling 7-day verdict. Shared by /api/verdict and the SSR page. */
export async function computeVerdictData(): Promise<VerdictData> {
    const window = rollingWindow(7)
    const dateFilter = windowWhere(window)
    const todayStr = window.to
    const windowDays = window.days

    const [cockpit, trainEntries, sleepEntries, dayEntries] = await Promise.all([
      buildCockpitWindow({ from: window.from, to: window.to, asOf: window.to }),
      prisma.trainingEntry.findMany({
        where: { date: dateFilter },
        orderBy: { date: 'desc' },
      }),
      prisma.sleepEntry.findMany({
        where: { date: dateFilter },
        orderBy: { date: 'desc' },
      }),
      prisma.dayEntry.findMany({
        where: { date: dateFilter },
        orderBy: { date: 'desc' },
      }),
    ])

    const series = cockpit.series || []
    const activeLoadDays = series.filter(d => (d.trainingLoad || 0) > 0 || (d.activityCount || 0) > 0)
    const totalLoad = series.reduce((s, d) => s + (d.trainingLoad || 0), 0)
    const foodDays = series.filter(d => d.foodLogged).length
    const foodLogged = series.filter(d => d.foodLogged)
    const qualitySleep = sleepEntries.filter(e => e.quality != null)
    const avgHours =
      qualitySleep.length > 0
        ? qualitySleep.reduce((s, e) => s + e.hours, 0) / qualitySleep.length
        : 0
    const avgQuality =
      qualitySleep.length > 0
        ? qualitySleep.reduce((s, e) => s + (e.quality as number), 0) / qualitySleep.length
        : 0

    const parsedDays = dayEntries.map(e => ({
      date: e.date,
      mode: e.mode,
      tags: JSON.parse(e.tags) as string[],
    }))
    const todayEntry = parsedDays.find(d => d.date === todayStr) ?? null
    const todayMode = todayEntry?.mode ?? null
    const alcoholDaysCount = parsedDays.filter(d => d.tags.includes('alcohol')).length
    const heavyMealDaysCount = parsedDays.filter(d => d.tags.includes('heavy_meal')).length
    const fuelledByTrainingDays = parsedDays.filter(
      d => d.tags.includes('heavy_meal') && d.tags.includes('intense_training'),
    ).length
    const travelDays = parsedDays.filter(d => d.tags.includes('travel')).length
    const lateNightDays = parsedDays.filter(d => d.tags.includes('late_night')).length

    // WP 2.2 — three pillars from cockpit/window core (Endurance removed: double-count).
    const hasDataP = activeLoadDays.length >= PILLAR_COVERAGE_MIN
    const hasDataN = foodDays >= PILLAR_COVERAGE_MIN
    const hasDataS = qualitySleep.length >= PILLAR_COVERAGE_MIN
    const anyPillarReady = hasDataP || hasDataN || hasDataS

    const scoreP = hasDataP ? clamp(Math.min(100, (totalLoad / Math.max(activeLoadDays.length, 1)) * 8 + activeLoadDays.length * 8)) : null

    const scoreN = hasDataN
      ? (() => {
          const kcalHits = foodLogged.filter(
            d => d.kcalIn != null && Math.abs(d.kcalIn - SOFT_KCAL_TARGET) <= 400,
          ).length
          const proteinHits = foodLogged.filter(
            d => d.proteinG != null && d.proteinG >= SOFT_PROTEIN_TARGET * 0.85,
          ).length
          const coveragePts = Math.min(40, (foodDays / windowDays) * 40)
          const kcalPts = Math.min(30, (kcalHits / foodDays) * 30)
          const proteinPts = Math.min(30, (proteinHits / foodDays) * 30)
          return clamp(coveragePts + kcalPts + proteinPts)
        })()
      : null

    const scoreS = hasDataS ? clamp(
      Math.min(((avgHours - 4) / 4) * 55, 55) +
        Math.min((avgQuality / 5) * 30, 30) +
        Math.min((qualitySleep.length / windowDays) * 14, 14),
    ) : null

    const scores = { P: scoreP, N: scoreN, S: scoreS, E: null as number | null }

    const ctx = {
      trainingSessions: activeLoadDays.length,
      totalLoad,
      sleepDaysLogged: qualitySleep.length,
      qualityNights: qualitySleep.length,
      avgHours,
      foodDays,
      alcoholDays: alcoholDaysCount,
      heavyMealDays: heavyMealDaysCount,
      fuelledByTrainingDays,
      travelDays,
      lateNightDays,
      todayMode,
      windowDays,
      hasDataP,
      hasDataN,
      hasDataS,
    }

    const pillars: VerdictPillar[] = [
      { key: 'P', label: 'Performance', score: scoreP, comment: pillarsComment('P', scoreP, ctx), icon: 'arrow-up-right', hasData: hasDataP },
      { key: 'N', label: 'Nutrition', score: scoreN, comment: pillarsComment('N', scoreN, ctx), icon: 'utensils', hasData: hasDataN },
      { key: 'S', label: 'Sleep', score: scoreS, comment: pillarsComment('S', scoreS, ctx), icon: 'moon', hasData: hasDataS },
    ]

    // ── Ledger (still event-level; scores above come from cockpit) ────────────

    const ledger: LedgerItem[] = []
    const trainDates = [...new Set(trainEntries.map(e => e.date))]

    for (const date of trainDates.slice(0, 3)) {
      const sets  = trainEntries.filter(e => e.date === date)
      const vol   = sets.reduce((s, e) => s + e.volume, 0)
      const topEx = sets.sort((a, b) => b.volume - a.volume)[0]?.exercise ?? 'Session'
      // M4: volume/80 → points, floor 1 (not falsy-fallback 8 which inflated tiny sessions)
      // Divisor 80 is undocumented — keep for now; document or replace in WP 2.2.
      const pts   = Math.min(Math.max(1, Math.round(vol / 80)), 20)
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
      const qualLabel = s.quality != null ? `quality ${s.quality}/5` : 'quality not measured'
      ledger.push({
        date: formatDate(s.date),
        label: `${s.hours.toFixed(1)}h — ${qualLabel}`,
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
          label: [hasAlc ? 'Alcohol' : null, hasHeavy ? (isFuelled ? 'Heavy meal (fuelling)' : 'Heavy meal') : null].filter(Boolean).join(' + ') || 'Context',
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

    const weekRange = `${formatDate(window.from)} — ${formatDate(window.to)}`

    return {
      headline:     buildHeadline(scores, todayMode, anyPillarReady),
      pillars,
      ledger:       ledger.slice(0, 6),
      auditorNote:  buildAuditorNote(scores, ctx, todayMode, anyPillarReady),
      weekRange,
      todayMode,
      hasEnoughData: anyPillarReady,
      modeNote,
      window: {
        label: 'rolling',
        from: window.from,
        to: window.to,
        days: window.days,
      },
    } satisfies VerdictData
}
