import { NextResponse } from 'next/server'
import { buildCockpitWindow } from '@/lib/engines/cockpitData'
import { detectSignals, type LabSignalContext } from '@/lib/signals/detectSignals'
import { interventionsFor } from '@/lib/signals/interventions'
import { listTrials } from '@/lib/signals/trialStore'
import { rollingWindow } from '@/lib/timeWindow'
import { prisma } from '@/lib/db'
import { loadBloodworkLatestSummary } from '@/lib/bloodworkLatestSummary'
import { normalizeMarkerCode, type RefFlag } from '@/lib/bloodworkFlags'

export const dynamic = 'force-dynamic'

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function daysBetween(fromYmd: string, toYmd: string): number | null {
  const a = Date.parse(`${fromYmd}T12:00:00Z`)
  const b = Date.parse(`${toYmd}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((b - a) / 86_400_000)
}

function flagForCode(
  markers: { code: string; flag: RefFlag }[],
  code: string,
): RefFlag | null {
  const hit = markers.find(m => normalizeMarkerCode(m.code) === code)
  return hit?.flag ?? null
}

/** WP 4.5 — four-line week cycle + stored weekly-feedback report. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const weekOf = searchParams.get('weekOf')?.trim()
    const wantList = searchParams.get('list') === '1'

    if (wantList) {
      const rows = await prisma.weeklyFeedbackReport.findMany({
        orderBy: { weekOf: 'desc' },
        take: 26,
        select: { weekOf: true, weekEnd: true, generatedAt: true },
      })
      return NextResponse.json({
        weeks: rows.map(r => ({
          weekOf: r.weekOf,
          weekEnd: r.weekEnd,
          generatedAt: r.generatedAt.toISOString(),
        })),
      })
    }

    const win = rollingWindow(7)
    const [cockpit, labsSummary] = await Promise.all([
      buildCockpitWindow({ from: win.from, to: win.to, asOf: win.to }),
      loadBloodworkLatestSummary(),
    ])
    const days = (cockpit.series || []).map(s => ({
      date: s.date,
      sleepHours: s.sleepHours,
      restingHr: s.restingHr,
      trainingLoad: s.trainingLoad,
      kcalIn: s.kcalIn,
      proteinG: s.proteinG,
      foodLogged: s.foodLogged,
      energyDelta: s.energyDelta,
      scaleKg: null as number | null,
    }))

    let labs: LabSignalContext | null = null
    if (labsSummary.present) {
      labs = {
        drawDate: labsSummary.drawDate,
        ferritinFlag: flagForCode(labsSummary.markers, 'ferritin'),
        tshFlag: flagForCode(labsSummary.markers, 'tsh'),
        panelAgeDays:
          labsSummary.drawDate != null ? daysBetween(labsSummary.drawDate, win.to) : null,
      }
    }

    const signals = detectSignals(days, labs)
    const interventions = interventionsFor(signals.map(s => s.id))
    const trials = listTrials()
    const lastTrial = [...trials].reverse().find(t => true) ?? null
    const top = signals[0]
    const plan = interventions[0]

    const cycle = {
      happened: cockpit.theRead?.headline || (top ? top.evidence : 'Quiet window — few detectable signals.'),
      why: top
        ? `${top.label} (${top.confidenceDays}d). ${top.unknowns.length ? `Unknowns: ${top.unknowns.join('; ')}` : 'Evidence thin but present.'}`
        : cockpit.theRead?.leadingCause?.label || 'No dominant cause this window.',
      plan: plan?.action || 'No intervention proposed — keep logging.',
      proof: lastTrial
        ? `Prior trial (${lastTrial.signalId}): ${lastTrial.outcome} · due ${lastTrial.dueAt}`
        : 'No prior intervention trial on file.',
      signals,
      interventions,
      unknowns: [...new Set(signals.flatMap(s => s.unknowns))],
      window: win,
      tone: cockpit.theRead?.tone ?? cockpit.theRead?.verdict ?? null,
    }

    const report = weekOf
      ? await prisma.weeklyFeedbackReport.findUnique({ where: { weekOf } })
      : await prisma.weeklyFeedbackReport.findFirst({ orderBy: { weekOf: 'desc' } })

    return NextResponse.json({
      cycle,
      report: report
        ? {
            weekOf: report.weekOf,
            weekEnd: report.weekEnd,
            combinedSummary: report.combinedSummary,
            healthAnalysis: report.healthAnalysis,
            claudeWorkAnalysis: report.claudeWorkAnalysis,
            wins: safeParse<string[]>(report.wins, []),
            improvements: safeParse<string[]>(report.improvements, []),
            healthActions: safeParse<string[]>(report.healthActions, []),
            metrics: safeParse<Record<string, unknown>>(report.metrics, {}),
            model: report.model,
            generatedAt: report.generatedAt.toISOString(),
          }
        : null,
    })
  } catch (error) {
    console.error('[weekly-feedback]', error)
    return NextResponse.json({ error: 'Failed to load weekly feedback' }, { status: 500 })
  }
}
