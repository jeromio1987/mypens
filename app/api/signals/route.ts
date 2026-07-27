import { NextResponse } from 'next/server'
import { buildCockpitWindow } from '@/lib/engines/cockpitData'
import { detectSignals, type LabSignalContext } from '@/lib/signals/detectSignals'
import { interventionsFor } from '@/lib/signals/interventions'
import { rollingWindow } from '@/lib/timeWindow'
import { loadBloodworkLatestSummary } from '@/lib/bloodworkLatestSummary'
import { normalizeMarkerCode, type RefFlag } from '@/lib/bloodworkFlags'

export const dynamic = 'force-dynamic'

function isIsoDate(s: string | null | undefined): s is string {
  return Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s))
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

/** WP 4.1–4.3 — signals + suggested interventions for a window. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const fromQ = searchParams.get('from')?.trim()
    const toQ = searchParams.get('to')?.trim()
    const fallback = rollingWindow(14)
    const from = isIsoDate(fromQ) ? fromQ : fallback.from
    const to = isIsoDate(toQ) ? toQ : fallback.to
    if (from > to) {
      return NextResponse.json({ error: 'from must be ≤ to' }, { status: 400 })
    }

    const [cockpit, labsSummary] = await Promise.all([
      buildCockpitWindow({ from, to, asOf: to }),
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
          labsSummary.drawDate != null ? daysBetween(labsSummary.drawDate, to) : null,
      }
    }

    const signals = detectSignals(days, labs)
    const interventions = interventionsFor(signals.map(s => s.id))

    return NextResponse.json({
      window: { label: 'rolling', from, to, days: days.length },
      signals,
      interventions,
      labsContext: labs,
      unknownsNote:
        'If food or RHR rows are thin, unknowns[] on each signal explain why confidence is low. Lab signals are soft confounders only — not medical advice.',
    })
  } catch (err) {
    console.error('[signals]', err)
    return NextResponse.json({ error: 'Failed to detect signals' }, { status: 500 })
  }
}
