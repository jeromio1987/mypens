import { prisma } from '@/lib/db'
import { estimateBmrDetailed, type BmrProfile } from '@/lib/energyBmr'
import {
  extractKcalFromExternalRaw,
  extractKcalFromNotes,
  extractKcalFromTraining,
} from '@/lib/energyKcalExtract'
import { estimateNeat } from '@/lib/energyNeat'
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
  sources: EnergyActivitySource[]
  neatDetail: string
  neatSource: string
  deviceRef: DeviceDayRef | null
  disclaimer: string
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

async function weightOnDate(date: string): Promise<number | null> {
  const w = await prisma.weightEntry.findFirst({
    where: { date: { lte: date } },
    orderBy: { date: 'desc' },
    select: { scaleKg: true },
  })
  return w?.scaleKg ?? null
}

async function loadDeviceDayMetrics(date: string): Promise<DeviceDayRef | null> {
  const rows = await prisma.garminDailyMetric.findMany({
    where: {
      date,
      kind: {
        in: ['steps', 'active_calories', 'resting_calories', 'total_calories', 'calories'],
      },
    },
    select: { kind: true, valueNum: true },
  })
  if (rows.length === 0) return null

  let steps: number | null = null
  let activeKcal: number | null = null
  let restingKcal: number | null = null
  let totalKcal: number | null = null

  for (const r of rows) {
    if (r.valueNum == null || !Number.isFinite(r.valueNum)) continue
    const v = Math.round(r.valueNum)
    if (r.kind === 'steps') steps = v
    else if (r.kind === 'active_calories') activeKcal = v
    else if (r.kind === 'resting_calories') restingKcal = v
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
  const [foodAgg, garminActs, training, pushed, profile, weightKg, deviceRef] = await Promise.all([
    prisma.foodEntry.aggregate({
      where: { date },
      _sum: { kcal: true },
    }),
    prisma.garminActivity.findMany({
      where: { date },
      select: { id: true, name: true, sport: true, calories: true, distanceM: true, durationSec: true },
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
    weightOnDate(date),
    loadDeviceDayMetrics(date),
  ])

  const foodKcal = roundKcal(foodAgg._sum.kcal ?? 0)
  const sources: EnergyActivitySource[] = []
  const hasGarminCals = garminActs.some(g => g.calories != null && g.calories > 0)
  const importedExternalIds = new Set(
    training.map(t => t.externalId).filter((id): id is string => Boolean(id)),
  )

  for (const g of garminActs) {
    if (g.calories != null && g.calories > 0) {
      const dist =
        g.distanceM && g.distanceM > 500
          ? ` · ${(g.distanceM / 1000).toFixed(1)} km`
          : ''
      sources.push({
        id: `garmin:${g.id}`,
        label: g.name || g.sport || 'Garmin activity',
        kcal: roundKcal(g.calories),
        origin: 'garmin_activity',
        detail: `${g.sport || 'activity'}${dist}`,
      })
    }
  }

  let sessionsMissingKcal = 0

  for (const t of training) {
    const extracted = extractKcalFromTraining(t)
    if (!extracted) {
      sessionsMissingKcal++
      continue
    }
    // Prefer GarminActivity archive calories over live garmin TrainingEntry duplicates
    if (t.source === 'garmin' && hasGarminCals) continue
    sources.push({
      id: `training:${t.id}`,
      label: t.exercise,
      kcal: roundKcal(extracted.kcal),
      origin: extracted.origin === 'notes' ? 'notes' : 'training',
      detail: t.source !== 'manual' ? t.source : undefined,
    })
  }

  // Unpromoted inbox workouts still contribute EAT when they have calories
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
    sources.push({
      id: `pushed:${p.id}`,
      label: p.exercise,
      kcal,
      origin: 'pushed',
      detail: `${p.source} inbox`,
    })
  }

  const eatKcal = roundKcal(
    sources
      .filter(s => s.origin === 'garmin_activity' || s.origin === 'training' || s.origin === 'notes' || s.origin === 'pushed')
      .reduce((s, x) => s + x.kcal, 0),
  )

  const sessionCount = training.length + garminActs.length + pushed.filter(p => !importedExternalIds.has(p.externalId)).length
  const neat = estimateNeat({
    sessionEatKcal: eatKcal,
    deviceActiveKcal: deviceRef?.activeKcal ?? null,
    steps: deviceRef?.steps ?? null,
    weightKg,
  })

  const bmr = estimateBmrDetailed(weightKg, profile)
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

  const incompleteCapture =
    (sessionCount > 0 && eatKcal === 0) ||
    (sessionsMissingKcal > 0 && eatKcal === 0)

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
    sources,
    neatDetail: neat.detail,
    neatSource: neat.source,
    deviceRef,
    disclaimer: DISCLAIMER,
  }
}

export async function getEnergyBalanceRange(from: string, to: string): Promise<DayEnergyBalance[]> {
  const days: string[] = []
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
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

type MetricKindMap = Map<string, Map<string, number>>

async function loadMetricsByDate(
  from: string,
  to: string,
): Promise<MetricKindMap> {
  const rows = await prisma.garminDailyMetric.findMany({
    where: {
      date: { gte: from, lte: to },
      kind: {
        in: ['steps', 'active_calories', 'resting_calories', 'total_calories', 'calories'],
      },
    },
    select: { date: true, kind: true, valueNum: true },
  })
  const map: MetricKindMap = new Map()
  for (const r of rows) {
    if (r.valueNum == null || !Number.isFinite(r.valueNum)) continue
    if (!map.has(r.date)) map.set(r.date, new Map())
    map.get(r.date)!.set(r.kind, Math.round(r.valueNum))
  }
  return map
}

function deviceActiveForDate(metrics: MetricKindMap, date: string): number | null {
  const m = metrics.get(date)
  if (!m) return null
  return m.get('active_calories') ?? null
}

function stepsForDate(metrics: MetricKindMap, date: string): number | null {
  const m = metrics.get(date)
  if (!m) return null
  return m.get('steps') ?? null
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
  }
> {
  const day =
    asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf)
      ? asOf
      : new Date().toISOString().slice(0, 10)
  const { from, to, dates } =
    daysBack === 7 ? rolling7Window(day) : rollingNWindow(day, daysBack)

  const weightFrom = (() => {
    const d = new Date(`${from}T12:00:00`)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()
  const weightTo = (() => {
    const d = new Date(`${to}T12:00:00`)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const [foodRows, garminActs, training, pushed, weights, metrics, profile, thyroidContext] =
    await Promise.all([
      prisma.foodEntry.groupBy({
        by: ['date'],
        where: { date: { gte: from, lte: to } },
        _sum: { kcal: true },
      }),
      prisma.garminActivity.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, calories: true },
      }),
      prisma.trainingEntry.findMany({
        where: { date: { gte: from, lte: to } },
        select: {
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
          date: true,
          calories: true,
          externalId: true,
          notes: true,
          raw: true,
        },
      }),
      prisma.weightEntry.findMany({
        where: { date: { gte: weightFrom, lte: weightTo } },
        select: { date: true, scaleKg: true },
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

  const garminByDate = new Map<string, number>()
  for (const g of garminActs) {
    if (g.calories != null && g.calories > 0) {
      garminByDate.set(g.date, (garminByDate.get(g.date) ?? 0) + g.calories)
    }
  }

  const trainingByDate = new Map<string, number>()
  const garminDatesWithCals = new Set(
    [...garminByDate.entries()].filter(([, v]) => v > 0).map(([d]) => d),
  )
  const importedIds = new Set(
    training.map(t => t.externalId).filter((id): id is string => Boolean(id)),
  )

  for (const t of training) {
    if (t.source === 'garmin' && garminDatesWithCals.has(t.date)) continue
    const extracted = extractKcalFromTraining(t)
    if (!extracted) continue
    trainingByDate.set(t.date, (trainingByDate.get(t.date) ?? 0) + extracted.kcal)
  }

  for (const p of pushed) {
    if (importedIds.has(p.externalId)) continue
    let kcal = p.calories != null && p.calories > 0 ? Math.round(p.calories) : null
    if (kcal == null) kcal = extractKcalFromExternalRaw(p.raw)
    if (kcal == null) kcal = extractKcalFromNotes(p.notes)
    if (kcal == null || kcal <= 0) continue
    trainingByDate.set(p.date, (trainingByDate.get(p.date) ?? 0) + kcal)
  }

  let weightSeries = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  if (weightSeries.length === 0 || weightSeries.every(w => w.date > from)) {
    const older = await prisma.weightEntry.findFirst({
      where: { date: { lte: from } },
      orderBy: { date: 'desc' },
      select: { date: true, scaleKg: true },
    })
    if (older) weightSeries = [older, ...weightSeries]
  }

  const raw: RawDayEnergy[] = dates.map(date => {
    const foodKcal = foodByDate.get(date) ?? 0
    const eatKcal = Math.round((garminByDate.get(date) ?? 0) + (trainingByDate.get(date) ?? 0))
    const weightKg = weightOnOrBefore(date, weightSeries)
    const neat = estimateNeat({
      sessionEatKcal: eatKcal,
      deviceActiveKcal: deviceActiveForDate(metrics, date),
      steps: stepsForDate(metrics, date),
      weightKg,
    })
    const bmr = estimateBmrDetailed(weightKg, profile)
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
  }
}

export async function getWeekEnergyRecap(
  asOf?: string,
): Promise<
  WeekEnergyRecap & {
    calibration: WeightCalibration | null
    thyroidContext: SchildklierRead | null
    windowDays: number
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
  }
> {
  return getRollingEnergyRecap(30, asOf)
}
