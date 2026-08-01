import { prisma } from '@/lib/db'
import { estimateBmrDetailed, type BmrProfile } from '@/lib/energyBmr'
import {
  extractKcalFromExternalRaw,
  extractKcalFromNotes,
  extractKcalFromTraining,
} from '@/lib/energyKcalExtract'
import { estimateNeat } from '@/lib/energyNeat'
import { resolveActiveCalories, resolveSteps } from '@/lib/dayMetricPrecedence'
import { foodCoverageNudge, type FoodCoverageNudge } from '@/lib/foodCoverageNudge'
import {
  buildWeekEnergyRecap,
  rolling7Window,
  rollingNWindow,
  type RawDayEnergy,
  type WeekEnergyRecap,
} from '@/lib/energyWeek'
import {
  calibrateWeekVsWeight,
  type WeightCalibration,
  type WeightPoint,
} from '@/lib/energyWeightCalibration'
import { schildklierRead, type SchildklierRead } from '@/lib/bloodworkThyroidRead'
import {
  dedupeSessions,
  parseTrainingWindow,
  sessionPreference,
  type SessionCandidate,
} from '@/lib/sessionDedupe'
import { fromDateStr, shiftDateStr, toDateStr, today } from '@/lib/timeWindow'

export {
  extractKcalFromExternalRaw,
  extractKcalFromNotes,
  extractKcalFromTraining,
} from '@/lib/energyKcalExtract'

export type EnergyActivitySource = {
  id: string
  label: string
  kcal: number
  origin: 'garmin_activity' | 'training' | 'notes' | 'pushed' | 'neat' | 'bmr'
  detail?: string
}

export type DeviceDayRef = {
  steps: number | null
  activeKcal: number | null
  restingKcal: number | null
  totalKcal: number | null
  /** Never summed into MY PENS out — reconciliation only. */
  note: string
}

export type DayEnergyBalance = {
  date: string
  foodKcal: number
  /** Session EAT kcal (Garmin/Strava/HC/training). */
  eatKcal: number
  neatKcal: number
  bmrKcal: number
  bmrMethod: string
  bmrLabel: string
  /** eat + neat (legacy "Activity" line). */
  activityKcal: number
  /** food − (BMR + EAT + NEAT) */
  delta: number
  estimatedOut: number
  incompleteCapture: boolean
  /** True when at least one FoodEntry exists for this date. */
  foodCoverage: boolean
  /** User marked this calendar day as food-incomplete (late entry / partial log). */
  foodIncomplete: boolean
  sources: EnergyActivitySource[]
  neatDetail: string
  neatSource: string
  deviceRef: DeviceDayRef | null
  disclaimer: string
  /** Soft 7d food-log coverage for Fueling nudge (not a diet score). */
  foodCoverage7d: FoodCoverageNudge
}

/** Pure incomplete-capture gate — zero-food days are not a real deficit/surplus. */
export function dayIncompleteCapture(opts: {
  foodIncomplete: boolean
  foodCoverage: boolean
  sessionCount: number
  eatKcal: number
  sessionsMissingKcal: number
}): boolean {
  return (
    opts.foodIncomplete ||
    !opts.foodCoverage ||
    (opts.sessionCount > 0 && opts.eatKcal === 0) ||
    (opts.sessionsMissingKcal > 0 && opts.eatKcal === 0)
  )
}

const DISCLAIMER =
  'Device estimates — not metabolic TDEE. Stack = Food − (BMR + EAT sessions + NEAT). Garmin Total/Resting/Active are reference only and are never added into the MY PENS sum.'

function roundKcal(n: number): number {
  return Math.round(n)
}

async function loadBmrProfile(): Promise<BmrProfile> {
  const s = await prisma.userSettings.findUnique({
    where: { id: 'default' },
    select: { heightCm: true, birthYear: true, sex: true },
  })
  return {
    heightCm: s?.heightCm ?? null,
    birthYear: s?.birthYear ?? null,
    sex: s?.sex ?? null,
  }
}

type WeightPointBf = { date: string; scaleKg: number; bodyFatPct: number | null }

/** Scale kg on/before date, plus most recent measured BF% on/before date (Tanita). */
async function weightAndBfOnDate(
  date: string,
): Promise<{ weightKg: number | null; bodyFatPct: number | null }> {
  const [w, bfRow] = await Promise.all([
    prisma.weightEntry.findFirst({
      where: { date: { lte: date } },
      orderBy: { date: 'desc' },
      select: { scaleKg: true, bodyFatPct: true },
    }),
    prisma.weightEntry.findFirst({
      where: { date: { lte: date }, bodyFatPct: { not: null } },
      orderBy: { date: 'desc' },
      select: { bodyFatPct: true },
    }),
  ])
  return {
    weightKg: w?.scaleKg ?? null,
    bodyFatPct: bfRow?.bodyFatPct ?? w?.bodyFatPct ?? null,
  }
}

function bodyFatOnOrBefore(date: string, weights: WeightPointBf[]): number | null {
  let best: number | null = null
  for (const w of weights) {
    if (w.date <= date && w.bodyFatPct != null) best = w.bodyFatPct
  }
  return best
}

async function loadDeviceDayMetrics(date: string): Promise<DeviceDayRef | null> {
  const rows = await prisma.garminDailyMetric.findMany({
    where: {
      date,
      kind: {
        in: [
          'steps',
          'steps_hc',
          'active_calories',
          'active_calories_hc',
          'resting_calories',
          'total_calories',
          'calories',
        ],
      },
    },
    select: { kind: true, valueNum: true, sourceFile: true, raw: true },
  })
  if (rows.length === 0) return null

  const steps = resolveSteps(rows)
  const activeKcal = resolveActiveCalories(rows)
  let restingKcal: number | null = null
  let totalKcal: number | null = null

  for (const r of rows) {
    if (r.valueNum == null || !Number.isFinite(r.valueNum)) continue
    const v = Math.round(r.valueNum)
    if (r.kind === 'resting_calories') restingKcal = v
    else if (r.kind === 'total_calories') totalKcal = v
    else if (r.kind === 'calories' && totalKcal == null) totalKcal = v
  }

  if (totalKcal == null && activeKcal != null && restingKcal != null) {
    totalKcal = activeKcal + restingKcal
  }

  if (steps == null && activeKcal == null && restingKcal == null && totalKcal == null) {
    return null
  }

  return {
    steps,
    activeKcal,
    restingKcal,
    totalKcal,
    note: 'Garmin day totals are reference only — never summed into MY PENS out.',
  }
}

export async function getDayEnergyBalance(date: string): Promise<DayEnergyBalance> {
  const coverageFrom = shiftDateStr(date, -6)
  const [foodAgg, garminActs, training, pushed, profile, weightRow, deviceRef, dayEntry, foodDays7] =
    await Promise.all([
    prisma.foodEntry.aggregate({
      where: { date },
      _sum: { kcal: true },
      _count: { _all: true },
    }),
    prisma.garminActivity.findMany({
      where: { date },
      select: {
        id: true,
        name: true,
        sport: true,
        calories: true,
        distanceM: true,
        durationSec: true,
        startedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.trainingEntry.findMany({
      where: { date },
      select: {
        id: true,
        exercise: true,
        notes: true,
        externalRaw: true,
        source: true,
        calories: true,
        externalId: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.pushedWorkout.findMany({
      where: { date },
      select: {
        id: true,
        exercise: true,
        calories: true,
        source: true,
        externalId: true,
        notes: true,
        raw: true,
      },
    }),
    loadBmrProfile(),
    weightAndBfOnDate(date),
    loadDeviceDayMetrics(date),
    prisma.dayEntry.findUnique({ where: { date }, select: { tags: true } }),
    prisma.foodEntry.groupBy({
      by: ['date'],
      where: { date: { gte: coverageFrom, lte: date } },
    }),
  ])

  const weightKg = weightRow.weightKg
  const bodyFatPct = weightRow.bodyFatPct

  let foodIncomplete = false
  try {
    const tags = JSON.parse(dayEntry?.tags || '[]')
    foodIncomplete = Array.isArray(tags) && tags.includes('food_incomplete')
  } catch {
    foodIncomplete = false
  }

  const foodKcal = roundKcal(foodAgg._sum.kcal ?? 0)
  const foodCoverage = (foodAgg._count?._all ?? 0) > 0
  const sources: EnergyActivitySource[] = []
  const importedExternalIds = new Set(
    training.map(t => t.externalId).filter((id): id is string => Boolean(id)),
  )

  type EatCand = SessionCandidate & {
    origin: EnergyActivitySource['origin']
    label: string
    detail?: string
    kcal: number
  }
  const candidates: EatCand[] = []
  let sessionsMissingKcal = 0

  for (const g of garminActs) {
    if (g.calories == null || g.calories <= 0) continue
    const dur = Math.round(g.durationSec || 0)
    const startMs: number | null = g.startedAt ? g.startedAt.getTime() : null
    const endMs: number | null = startMs != null && dur > 0 ? startMs + dur * 1000 : null
    const dist =
      g.distanceM && g.distanceM > 500 ? ` · ${(g.distanceM / 1000).toFixed(1)} km` : ''
    candidates.push({
      id: `garmin:${g.id}`,
      startMs,
      endMs,
      durationSec: dur,
      source: 'garmin_activity',
      preference: sessionPreference('garmin_activity'),
      kcal: roundKcal(g.calories),
      origin: 'garmin_activity',
      label: g.name || g.sport || 'Garmin activity',
      detail: `${g.sport || 'activity'}${dist}`,
    })
  }

  for (const t of training) {
    const extracted = extractKcalFromTraining(t)
    if (!extracted) {
      sessionsMissingKcal++
      continue
    }
    const win = parseTrainingWindow(t.externalRaw)
    candidates.push({
      id: `training:${t.id}`,
      startMs: win.startMs,
      endMs: win.endMs,
      durationSec: win.durationSec,
      source: t.source,
      preference: sessionPreference('training', t.source, win.packageName),
      kcal: roundKcal(extracted.kcal),
      origin: extracted.origin === 'notes' ? 'notes' : 'training',
      label: t.exercise,
      detail: t.source !== 'manual' ? t.source : undefined,
    })
  }

  for (const p of pushed) {
    if (importedExternalIds.has(p.externalId)) continue
    let kcal =
      p.calories != null && p.calories > 0 ? Math.round(p.calories) : null
    if (kcal == null) kcal = extractKcalFromExternalRaw(p.raw)
    if (kcal == null) kcal = extractKcalFromNotes(p.notes)
    if (kcal == null || kcal <= 0) {
      sessionsMissingKcal++
      continue
    }
    // Pushed inbox rarely has reliable start — leave untimed (kept; no false overlap).
    candidates.push({
      id: `pushed:${p.id}`,
      startMs: null,
      endMs: null,
      durationSec: 0,
      source: p.source,
      preference: sessionPreference('pushed', p.source),
      kcal,
      origin: 'pushed',
      label: p.exercise,
      detail: `${p.source} inbox`,
    })
  }

  const keptSessions = dedupeSessions(candidates)
  for (const s of keptSessions) {
    sources.push({
      id: s.id,
      label: s.label,
      kcal: s.kcal,
      origin: s.origin,
      detail: s.detail,
    })
  }

  const eatKcal = roundKcal(keptSessions.reduce((sum, x) => sum + x.kcal, 0))

  const sessionCount =
    training.length +
    garminActs.length +
    pushed.filter(p => !importedExternalIds.has(p.externalId)).length
  const neat = estimateNeat({
    sessionEatKcal: eatKcal,
    deviceActiveKcal: deviceRef?.activeKcal ?? null,
    steps: deviceRef?.steps ?? null,
    weightKg,
  })

  const bmr = estimateBmrDetailed(weightKg, profile, bodyFatPct)
  const activityKcal = roundKcal(eatKcal + neat.neatKcal)
  const estimatedOut = roundKcal(bmr.kcal + eatKcal + neat.neatKcal)
  const delta = roundKcal(foodKcal - estimatedOut)

  if (neat.neatKcal > 0) {
    sources.push({
      id: `neat:${date}`,
      label: neat.source === 'device_active_residual' ? 'NEAT (Active residual)' : 'NEAT (steps model)',
      kcal: neat.neatKcal,
      origin: 'neat',
      detail: neat.detail,
    })
  }
  if (bmr.kcal > 0) {
    sources.push({
      id: `bmr:${date}`,
      label: bmr.label,
      kcal: bmr.kcal,
      origin: 'bmr',
      detail: bmr.method,
    })
  }

  const incompleteCapture = dayIncompleteCapture({
    foodIncomplete,
    foodCoverage,
    sessionCount,
    eatKcal,
    sessionsMissingKcal,
  })

  return {
    date,
    foodKcal,
    eatKcal,
    neatKcal: neat.neatKcal,
    bmrKcal: bmr.kcal,
    bmrMethod: bmr.method,
    bmrLabel: bmr.label,
    activityKcal,
    delta,
    estimatedOut,
    incompleteCapture,
    foodCoverage,
    foodIncomplete,
    sources,
    neatDetail: neat.detail,
    neatSource: neat.source,
    deviceRef,
    disclaimer: DISCLAIMER,
    foodCoverage7d: foodCoverageNudge(foodDays7.length, 7),
  }
}

export type WindowDayEnergy = {
  date: string
  kcalIn: number
  proteinG: number
  carbsG: number
  fatG: number
  /** True only when at least one FoodEntry exists for this date — distinguishes "0 kcal logged" from "not logged". */
  foodCoverage: boolean
  eatKcal: number
  neatKcal: number
  /** NEAT path — causal/signals down-rank deficit claims when `steps_model` (E2). */
  neatSource: string
  bmrKcal: number
  activityKcal: number
  estimatedOut: number
  /** kcalIn − estimatedOut. Null when foodCoverage is false — an unlogged day is not a real deficit/surplus. */
  delta: number | null
}

function windowDates(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = fromDateStr(from); toDateStr(d) <= to; d.setDate(d.getDate() + 1)) {
    days.push(toDateStr(d))
  }
  return days
}

/**
 * Batched (window-scoped, NOT per-day query) energy + macro balance for an
 * arbitrary [from, to] date range — added for WP 2.1 to feed nutrition into
 * the period-review cockpit day/window core without the N-day query cost of
 * calling getDayEnergyBalance per day. Deliberately separate from
 * getDayEnergyBalance / getRollingEnergyRecap (left untouched) so existing
 * /api/energy-balance behaviour is unaffected.
 *
 * Only queries the given [from, to] window (plus a small weight lookback for
 * BMR) — never allTime — per WP 2.1 constraints.
 */
export async function getEnergyBalanceForRange(from: string, to: string): Promise<WindowDayEnergy[]> {
  const dates = windowDates(from, to)
  if (!dates.length) return []

  const weightFrom = shiftDateStr(from, -60)

  const [foodRows, garminActs, training, pushed, weights, metrics, profile] = await Promise.all([
    prisma.foodEntry.groupBy({
      by: ['date'],
      where: { date: { gte: from, lte: to } },
      _sum: { kcal: true, proteinG: true, carbsG: true, fatG: true },
    }),
    prisma.garminActivity.findMany({
      where: { date: { gte: from, lte: to } },
      select: {
        id: true,
        date: true,
        calories: true,
        durationSec: true,
        startedAt: true,
      },
    }),
    prisma.trainingEntry.findMany({
      where: { date: { gte: from, lte: to } },
      select: {
        id: true,
        date: true,
        notes: true,
        externalRaw: true,
        source: true,
        calories: true,
        externalId: true,
      },
    }),
    prisma.pushedWorkout.findMany({
      where: { date: { gte: from, lte: to } },
      select: {
        id: true,
        date: true,
        calories: true,
        source: true,
        externalId: true,
        notes: true,
        raw: true,
      },
    }),
    prisma.weightEntry.findMany({
      where: { date: { gte: weightFrom, lte: to } },
      orderBy: { date: 'asc' },
      select: { date: true, scaleKg: true, bodyFatPct: true },
    }),
    prisma.garminDailyMetric.findMany({
      where: {
        date: { gte: from, lte: to },
        kind: { in: ['steps', 'steps_hc', 'active_calories', 'active_calories_hc'] },
      },
      select: { date: true, kind: true, valueNum: true, sourceFile: true, raw: true },
    }),
    loadBmrProfile(),
  ])

  let weightSeries: WeightPointBf[] = weights.map(w => ({
    date: w.date,
    scaleKg: w.scaleKg,
    bodyFatPct: w.bodyFatPct,
  }))
  if (weightSeries.length === 0 || weightSeries.every(w => w.date > from)) {
    const older = await prisma.weightEntry.findFirst({
      where: { date: { lte: from } },
      orderBy: { date: 'desc' },
      select: { date: true, scaleKg: true, bodyFatPct: true },
    })
    if (older) weightSeries = [older, ...weightSeries]
  }

  const foodByDate = new Map<
    string,
    { kcalIn: number; proteinG: number; carbsG: number; fatG: number }
  >()
  for (const r of foodRows) {
    foodByDate.set(r.date, {
      kcalIn: roundKcal(r._sum.kcal ?? 0),
      proteinG: Math.round((r._sum.proteinG ?? 0) * 10) / 10,
      carbsG: Math.round((r._sum.carbsG ?? 0) * 10) / 10,
      fatG: Math.round((r._sum.fatG ?? 0) * 10) / 10,
    })
  }

  const importedIds = new Set(
    training.map(t => t.externalId).filter((id): id is string => Boolean(id)),
  )

  const candidatesByDate = new Map<string, SessionCandidate[]>()
  const pushCand = (date: string, c: SessionCandidate) => {
    if (!candidatesByDate.has(date)) candidatesByDate.set(date, [])
    candidatesByDate.get(date)!.push(c)
  }

  for (const g of garminActs) {
    if (g.calories == null || g.calories <= 0) continue
    const dur = Math.round(g.durationSec || 0)
    const startMs: number | null = g.startedAt ? g.startedAt.getTime() : null
    const endMs: number | null = startMs != null && dur > 0 ? startMs + dur * 1000 : null
    pushCand(g.date, {
      id: `garmin:${g.id}`,
      startMs,
      endMs,
      durationSec: dur,
      source: 'garmin_activity',
      preference: sessionPreference('garmin_activity'),
      kcal: g.calories,
    })
  }

  for (const t of training) {
    const extracted = extractKcalFromTraining(t)
    if (!extracted) continue
    const win = parseTrainingWindow(t.externalRaw)
    pushCand(t.date, {
      id: `training:${t.id}`,
      startMs: win.startMs,
      endMs: win.endMs,
      durationSec: win.durationSec,
      source: t.source,
      preference: sessionPreference('training', t.source, win.packageName),
      kcal: extracted.kcal,
    })
  }

  for (const p of pushed) {
    if (importedIds.has(p.externalId)) continue
    let kcal = p.calories != null && p.calories > 0 ? Math.round(p.calories) : null
    if (kcal == null) kcal = extractKcalFromExternalRaw(p.raw)
    if (kcal == null) kcal = extractKcalFromNotes(p.notes)
    if (kcal == null || kcal <= 0) continue
    pushCand(p.date, {
      id: `pushed:${p.id}`,
      startMs: null,
      endMs: null,
      durationSec: 0,
      source: p.source,
      preference: sessionPreference('pushed', p.source),
      kcal,
    })
  }

  const eatByDate = new Map<string, number>()
  for (const [date, cands] of candidatesByDate) {
    const kept = dedupeSessions(cands)
    eatByDate.set(
      date,
      roundKcal(kept.reduce((s, x) => s + (x.kcal ?? 0), 0)),
    )
  }

  const metricsByDate = new Map<string, typeof metrics>()
  for (const m of metrics) {
    if (!metricsByDate.has(m.date)) metricsByDate.set(m.date, [])
    metricsByDate.get(m.date)!.push(m)
  }

  return dates.map(date => {
    const food = foodByDate.get(date)
    const kcalIn = food?.kcalIn ?? 0
    const proteinG = food?.proteinG ?? 0
    const carbsG = food?.carbsG ?? 0
    const fatG = food?.fatG ?? 0
    const foodCoverage = Boolean(food)

    const eatKcal = eatByDate.get(date) ?? 0
    const weightKg = weightOnOrBefore(date, weightSeries)
    const bodyFatPct = bodyFatOnOrBefore(date, weightSeries)
    const dayRows = metricsByDate.get(date) ?? []
    const neat = estimateNeat({
      sessionEatKcal: eatKcal,
      deviceActiveKcal: resolveActiveCalories(dayRows),
      steps: resolveSteps(dayRows),
      weightKg,
    })
    const bmr = estimateBmrDetailed(weightKg, profile, bodyFatPct)
    const activityKcal = roundKcal(eatKcal + neat.neatKcal)
    const estimatedOut = roundKcal(bmr.kcal + activityKcal)
    const delta = foodCoverage ? roundKcal(kcalIn - estimatedOut) : null

    return {
      date,
      kcalIn,
      proteinG,
      carbsG,
      fatG,
      foodCoverage,
      eatKcal,
      neatKcal: neat.neatKcal,
      neatSource: neat.source,
      bmrKcal: bmr.kcal,
      activityKcal,
      estimatedOut,
      delta,
    }
  })
}

export async function getEnergyBalanceRange(from: string, to: string): Promise<DayEnergyBalance[]> {
  const days = windowDates(from, to)
  const out: DayEnergyBalance[] = []
  for (const date of days) {
    out.push(await getDayEnergyBalance(date))
  }
  return out
}

function weightOnOrBefore(
  date: string,
  weights: { date: string; scaleKg: number }[],
): number | null {
  let best: number | null = null
  for (const w of weights) {
    if (w.date <= date) best = w.scaleKg
  }
  return best
}

async function loadThyroidSoftContext(): Promise<SchildklierRead | null> {
  const panel = await prisma.bloodworkPanel.findFirst({
    orderBy: { drawDate: 'desc' },
    include: { markers: true },
  })
  if (!panel) return null
  const read = schildklierRead(
    panel.markers.map(m => ({
      code: m.code,
      label: m.label,
      valueNum: m.valueNum,
      refLow: m.refLow,
      refHigh: m.refHigh,
      unit: m.unit,
    })),
  )
  return read.present ? read : null
}

type MetricRow = {
  date: string
  kind: string
  valueNum: number | null
  sourceFile: string | null
  raw: string | null
}
type MetricRowsByDate = Map<string, MetricRow[]>

async function loadMetricsByDate(from: string, to: string): Promise<MetricRowsByDate> {
  const rows = await prisma.garminDailyMetric.findMany({
    where: {
      date: { gte: from, lte: to },
      kind: {
        in: [
          'steps',
          'steps_hc',
          'active_calories',
          'active_calories_hc',
          'resting_calories',
          'total_calories',
          'calories',
        ],
      },
    },
    select: { date: true, kind: true, valueNum: true, sourceFile: true, raw: true },
  })
  const map: MetricRowsByDate = new Map()
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, [])
    map.get(r.date)!.push(r)
  }
  return map
}

function deviceActiveForDate(metrics: MetricRowsByDate, date: string): number | null {
  return resolveActiveCalories(metrics.get(date) ?? [])
}

function stepsForDate(metrics: MetricRowsByDate, date: string): number | null {
  return resolveSteps(metrics.get(date) ?? [])
}

/**
 * Rolling N-day energy recap ending `asOf`, with imputed gaps + scale calibration.
 */
export async function getRollingEnergyRecap(
  daysBack: 7 | 30,
  asOf?: string,
): Promise<
  WeekEnergyRecap & {
    calibration: WeightCalibration | null
    thyroidContext: SchildklierRead | null
    windowDays: number
    foodCoverage: FoodCoverageNudge
  }
> {
  const day =
    asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf)
      ? asOf
      : today()
  const { from, to, dates } =
    daysBack === 7 ? rolling7Window(day) : rollingNWindow(day, daysBack)

  const weightFrom = shiftDateStr(from, -1)
  const weightTo = shiftDateStr(to, 1)

  const [foodRows, garminActs, training, pushed, weights, metrics, profile, thyroidContext] =
    await Promise.all([
      prisma.foodEntry.groupBy({
        by: ['date'],
        where: { date: { gte: from, lte: to } },
        _sum: { kcal: true },
      }),
      prisma.garminActivity.findMany({
        where: { date: { gte: from, lte: to } },
        select: {
          id: true,
          date: true,
          calories: true,
          durationSec: true,
          startedAt: true,
        },
      }),
      prisma.trainingEntry.findMany({
        where: { date: { gte: from, lte: to } },
        select: {
          id: true,
          date: true,
          notes: true,
          externalRaw: true,
          source: true,
          calories: true,
          externalId: true,
        },
      }),
      prisma.pushedWorkout.findMany({
        where: { date: { gte: from, lte: to } },
        select: {
          id: true,
          date: true,
          calories: true,
          source: true,
          externalId: true,
          notes: true,
          raw: true,
        },
      }),
      prisma.weightEntry.findMany({
        where: { date: { gte: weightFrom, lte: weightTo } },
        select: { date: true, scaleKg: true, bodyFatPct: true },
        orderBy: { date: 'asc' },
      }),
      loadMetricsByDate(from, to),
      loadBmrProfile(),
      loadThyroidSoftContext(),
    ])

  const foodByDate = new Map<string, number>()
  for (const r of foodRows) {
    foodByDate.set(r.date, Math.round(r._sum.kcal ?? 0))
  }

  const importedIds = new Set(
    training.map(t => t.externalId).filter((id): id is string => Boolean(id)),
  )

  const candidatesByDate = new Map<string, SessionCandidate[]>()
  const pushCand = (date: string, c: SessionCandidate) => {
    if (!candidatesByDate.has(date)) candidatesByDate.set(date, [])
    candidatesByDate.get(date)!.push(c)
  }

  for (const g of garminActs) {
    if (g.calories == null || g.calories <= 0) continue
    const dur = Math.round(g.durationSec || 0)
    const startMs: number | null = g.startedAt ? g.startedAt.getTime() : null
    const endMs: number | null = startMs != null && dur > 0 ? startMs + dur * 1000 : null
    pushCand(g.date, {
      id: `garmin:${g.id}`,
      startMs,
      endMs,
      durationSec: dur,
      source: 'garmin_activity',
      preference: sessionPreference('garmin_activity'),
      kcal: g.calories,
    })
  }

  for (const t of training) {
    const extracted = extractKcalFromTraining(t)
    if (!extracted) continue
    const win = parseTrainingWindow(t.externalRaw)
    pushCand(t.date, {
      id: `training:${t.id}`,
      startMs: win.startMs,
      endMs: win.endMs,
      durationSec: win.durationSec,
      source: t.source,
      preference: sessionPreference('training', t.source, win.packageName),
      kcal: extracted.kcal,
    })
  }

  for (const p of pushed) {
    if (importedIds.has(p.externalId)) continue
    let kcal = p.calories != null && p.calories > 0 ? Math.round(p.calories) : null
    if (kcal == null) kcal = extractKcalFromExternalRaw(p.raw)
    if (kcal == null) kcal = extractKcalFromNotes(p.notes)
    if (kcal == null || kcal <= 0) continue
    pushCand(p.date, {
      id: `pushed:${p.id}`,
      startMs: null,
      endMs: null,
      durationSec: 0,
      source: p.source ?? 'pushed',
      preference: sessionPreference('pushed', p.source),
      kcal,
    })
  }

  const eatByDate = new Map<string, number>()
  for (const [date, cands] of candidatesByDate) {
    const kept = dedupeSessions(cands)
    eatByDate.set(date, Math.round(kept.reduce((s, x) => s + (x.kcal ?? 0), 0)))
  }

  let weightSeries: WeightPointBf[] = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  if (weightSeries.length === 0 || weightSeries.every(w => w.date > from)) {
    const older = await prisma.weightEntry.findFirst({
      where: { date: { lte: from } },
      orderBy: { date: 'desc' },
      select: { date: true, scaleKg: true, bodyFatPct: true },
    })
    if (older) weightSeries = [older, ...weightSeries]
  }

  const raw: RawDayEnergy[] = dates.map(date => {
    const foodKcal = foodByDate.get(date) ?? 0
    const eatKcal = eatByDate.get(date) ?? 0
    const weightKg = weightOnOrBefore(date, weightSeries)
    const bodyFatPct = bodyFatOnOrBefore(date, weightSeries)
    const neat = estimateNeat({
      sessionEatKcal: eatKcal,
      deviceActiveKcal: deviceActiveForDate(metrics, date),
      steps: stepsForDate(metrics, date),
      weightKg,
    })
    const bmr = estimateBmrDetailed(weightKg, profile, bodyFatPct)
    return {
      date,
      foodKcal,
      activityKcal: eatKcal + neat.neatKcal,
      eatKcal,
      neatKcal: neat.neatKcal,
      bmrOverride: bmr.kcal,
      bmrMethod: bmr.method,
      weightKg,
    }
  })

  const recap = buildWeekEnergyRecap(raw)

  const calibWeights: WeightPoint[] = weights
    .filter(w => w.date >= from && w.date <= to)
    .map(w => ({ date: w.date, scaleKg: w.scaleKg }))
  const calibPool: WeightPoint[] =
    calibWeights.length >= 2
      ? calibWeights
      : weights.map(w => ({ date: w.date, scaleKg: w.scaleKg }))

  const calibration = calibrateWeekVsWeight(recap.summary.weekNetKcal, calibPool)

  return {
    ...recap,
    calibration,
    thyroidContext,
    windowDays: daysBack,
    foodCoverage: foodCoverageNudge(foodByDate.size, daysBack),
  }
}

export async function getWeekEnergyRecap(
  asOf?: string,
): Promise<
  WeekEnergyRecap & {
    calibration: WeightCalibration | null
    thyroidContext: SchildklierRead | null
    windowDays: number
    foodCoverage: FoodCoverageNudge
  }
> {
  return getRollingEnergyRecap(7, asOf)
}

export async function getMonthEnergyRecap(
  asOf?: string,
): Promise<
  WeekEnergyRecap & {
    calibration: WeightCalibration | null
    thyroidContext: SchildklierRead | null
    windowDays: number
    foodCoverage: FoodCoverageNudge
  }
> {
  return getRollingEnergyRecap(30, asOf)
}
