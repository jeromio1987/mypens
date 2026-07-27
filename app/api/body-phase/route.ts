import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deriveTargets, isBodyPhase, type BodyPhase } from '@/lib/bodyPhase'
import { readBodyPhase, writeBodyPhase } from '@/lib/bodyPhaseStore'

export const dynamic = 'force-dynamic'

async function latestWeight(): Promise<number | null> {
  const w = await prisma.weightEntry.findFirst({
    orderBy: { date: 'desc' },
    select: { scaleKg: true },
  })
  return w?.scaleKg ?? null
}

/** Soft maintenance: last 14d mean estimatedOut when food logged — else null. */
async function softMaintenance(): Promise<number | null> {
  try {
    const { getEnergyBalanceForRange } = await import('@/lib/energyBalance')
    const { rollingWindow } = await import('@/lib/timeWindow')
    const win = rollingWindow(14)
    const rows = await getEnergyBalanceForRange(win.from, win.to)
    const outs = rows.filter(r => r.foodCoverage).map(r => r.estimatedOut)
    if (outs.length < 4) return null
    return Math.round(outs.reduce((a, b) => a + b, 0) / outs.length)
  } catch {
    return null
  }
}

export async function GET() {
  const state = await readBodyPhase()
  const weightKg = await latestWeight()
  const maint = await softMaintenance()
  const targets = deriveTargets(state.phase, weightKg, maint, state.kgPerWeek)
  return NextResponse.json({
    ...state,
    weightKg,
    maintenanceKcal: maint,
    targets,
    source: 'derived_from_phase',
  })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      phase?: string
      kgPerWeek?: number
      startedAt?: string
      expectedEndAt?: string | null
    }
    if (!isBodyPhase(body.phase)) {
      return NextResponse.json({ error: 'phase must be cut|bulk|recomp|maintain' }, { status: 400 })
    }
    const state = await writeBodyPhase({
      phase: body.phase as BodyPhase,
      kgPerWeek: body.kgPerWeek,
      startedAt: body.startedAt,
      expectedEndAt: body.expectedEndAt,
    })
    const weightKg = await latestWeight()
    const maint = await softMaintenance()
    const targets = deriveTargets(state.phase, weightKg, maint, state.kgPerWeek)
    return NextResponse.json({
      ...state,
      weightKg,
      maintenanceKcal: maint,
      targets,
      source: 'derived_from_phase',
    })
  } catch (err) {
    console.error('[body-phase]', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
