/**
 * Rough resting burn stub: ~22 kcal per kg body weight / day.
 * Not Mifflin-St Jeor — ledger framing only.
 */
export const BMR_KCAL_PER_KG = 22

/** Rough rule of thumb: ~7700 kcal ≈ 1 kg tissue change (highly approximate). */
export const KCAL_PER_KG = 7700

export function estimateBmrKcal(weightKg: number | null | undefined): number {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return 0
  return Math.round(BMR_KCAL_PER_KG * weightKg)
}

export function isoDateOffset(asOf: string, daysBack: number): string {
  const d = new Date(`${asOf}T12:00:00`)
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().slice(0, 10)
}

export function rolling7Window(asOf: string): { from: string; to: string; dates: string[] } {
  const to = asOf
  const from = isoDateOffset(asOf, 6)
  const dates: string[] = []
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return { from, to, dates }
}

export type RawDayEnergy = {
  date: string
  foodKcal: number
  activityKcal: number
  /** Latest scale kg on/before this date, if any */
  weightKg: number | null
}

export type WeekDayEnergy = {
  date: string
  foodKcal: number
  activityKcal: number
  bmrKcal: number
  estimatedOut: number
  /** food − (activity + BMR); negative = deficit vs ledger */
  delta: number
  tracked: boolean
  imputed: boolean
  bmrMissing: boolean
}

export type WeekEnergySummary = {
  from: string
  to: string
  daysTracked: number
  daysImputed: number
  foodKcalTotal: number
  activityKcalTotal: number
  bmrKcalTotal: number
  estimatedOutTotal: number
  /** Sum of deltas including imputed days */
  weekNetKcal: number
  /** Sum of deltas on tracked days only */
  trackedNetKcal: number
  avgDailyNetKcal: number
  bmrMissingDays: number
  disclaimer: string
}

export type WeekEnergyRecap = {
  window: { from: string; to: string }
  days: WeekDayEnergy[]
  summary: WeekEnergySummary
}

const WEEK_DISCLAIMER =
  'Rolling 7-day ledger: food vs activity burn + light BMR stub (~22 kcal/kg). Missing days use the average of tracked days — labeled imputed. Not metabolic TDEE.'

function mean(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Pure week builder: impute missing days from means of tracked days.
 * Tracked = food > 0 OR activity > 0.
 */
export function buildWeekEnergyRecap(rawDays: RawDayEnergy[]): WeekEnergyRecap {
  if (rawDays.length === 0) {
    return {
      window: { from: '', to: '' },
      days: [],
      summary: {
        from: '',
        to: '',
        daysTracked: 0,
        daysImputed: 0,
        foodKcalTotal: 0,
        activityKcalTotal: 0,
        bmrKcalTotal: 0,
        estimatedOutTotal: 0,
        weekNetKcal: 0,
        trackedNetKcal: 0,
        avgDailyNetKcal: 0,
        bmrMissingDays: 0,
        disclaimer: WEEK_DISCLAIMER,
      },
    }
  }

  const tracked = rawDays.filter(d => d.foodKcal > 0 || d.activityKcal > 0)
  const avgFood = mean(tracked.map(d => d.foodKcal))
  const avgAct = mean(tracked.map(d => d.activityKcal))

  const days: WeekDayEnergy[] = rawDays.map(d => {
    const isTracked = d.foodKcal > 0 || d.activityKcal > 0
    const foodKcal = Math.round(isTracked ? d.foodKcal : avgFood)
    const activityKcal = Math.round(isTracked ? d.activityKcal : avgAct)
    const bmrMissing = d.weightKg == null || d.weightKg <= 0
    const bmrKcal = estimateBmrKcal(d.weightKg)
    const estimatedOut = activityKcal + bmrKcal
    const delta = Math.round(foodKcal - estimatedOut)
    return {
      date: d.date,
      foodKcal,
      activityKcal,
      bmrKcal,
      estimatedOut,
      delta,
      tracked: isTracked,
      imputed: !isTracked,
      bmrMissing,
    }
  })

  const daysTracked = days.filter(d => d.tracked).length
  const daysImputed = days.filter(d => d.imputed).length
  const weekNetKcal = days.reduce((s, d) => s + d.delta, 0)
  const trackedNetKcal = days.filter(d => d.tracked).reduce((s, d) => s + d.delta, 0)

  return {
    window: { from: rawDays[0].date, to: rawDays[rawDays.length - 1].date },
    days,
    summary: {
      from: rawDays[0].date,
      to: rawDays[rawDays.length - 1].date,
      daysTracked,
      daysImputed,
      foodKcalTotal: days.reduce((s, d) => s + d.foodKcal, 0),
      activityKcalTotal: days.reduce((s, d) => s + d.activityKcal, 0),
      bmrKcalTotal: days.reduce((s, d) => s + d.bmrKcal, 0),
      estimatedOutTotal: days.reduce((s, d) => s + d.estimatedOut, 0),
      weekNetKcal,
      trackedNetKcal,
      avgDailyNetKcal: Math.round(weekNetKcal / days.length),
      bmrMissingDays: days.filter(d => d.bmrMissing).length,
      disclaimer: WEEK_DISCLAIMER,
    },
  }
}
