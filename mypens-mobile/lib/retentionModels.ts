export type ConfidenceLevel = 'high' | 'medium' | 'low'

/** Mirror of web lib/retentionModels TRUE_WEIGHT_MODEL_VERSION (WP 2.5). */
export const TRUE_WEIGHT_MODEL_VERSION = 'v3-2026-07' as const

export interface WeightBreakdown {
  scaleKg: number
  creatineKg: number
  alcoholKg: number
  glycogenKg: number
  sodiumKg: number
  hardTrainingKg: number
  trueWeightKg: number
  tanitaReliable: boolean
  tanitaFlags: string[]
  confidence: ConfidenceLevel
  activeConfounders: number
  modelVersion?: typeof TRUE_WEIGHT_MODEL_VERSION
}

export function estimateCreatineRetention(doseG: number, daysOn: number, postLoad = false) {
  if (doseG === 0 || daysOn === 0) return { retentionKg: 0, phase: 'none' }
  const isLoading = doseG >= 10
  if (isLoading) {
    const ramp = Math.min(daysOn / 7, 1)
    return { retentionKg: parseFloat((ramp * 1.0).toFixed(2)), phase: 'loading' }
  }
  if (postLoad) {
    return { retentionKg: 1.0, phase: 'saturated' }
  }
  const saturation = Math.min(daysOn / 28, 1)
  return {
    retentionKg: parseFloat((saturation * 0.4).toFixed(2)),
    phase: saturation >= 0.9 ? 'saturated' : 'maintenance',
  }
}

export function estimateAlcoholImpact(units: number, hoursSince: number) {
  if (units === 0) return { retentionKg: 0, kcal: 0, fatBurnSuppressed: false, hoursImpaired: 0 }
  const kcal = Math.round(units * 56)
  const retentionPeakKg = units * 0.25
  const decayFactor = Math.max(0, 1 - hoursSince / 48)
  const retentionKg = parseFloat((retentionPeakKg * decayFactor).toFixed(2))
  const hoursImpaired = Math.max(0, units - hoursSince)
  return { retentionKg, kcal, fatBurnSuppressed: hoursImpaired > 0, hoursImpaired }
}

export function estimateGlycogenRetention(carbsG: number) {
  if (carbsG === 0) return { retentionKg: 0 }
  const excessCarbs = Math.max(0, carbsG - 150)
  const waterBoundG = excessCarbs * 0.5 * 3.5
  return { retentionKg: parseFloat((waterBoundG / 1000).toFixed(2)) }
}

export function estimateSodiumRetention(highSodium: boolean, restaurantMeal: boolean): number {
  if (highSodium) return 0.3
  if (restaurantMeal) return 0.15
  return 0
}

export function estimateHardTrainingRetention(hardTraining: boolean): number {
  return hardTraining ? 0.3 : 0
}

export function assessTanitaReliability(ctx: {
  creatineDoseG: number
  creatineDaysOn: number
  hoursSinceAlcohol: number
  hardTraining: boolean
  morningReading: boolean
  highSodium?: boolean
  restaurantMeal?: boolean
  flightDay?: boolean
  illnessDay?: boolean
}) {
  const flags: string[] = []
  if (ctx.creatineDoseG >= 10 && ctx.creatineDaysOn <= 14)
    flags.push('Creatine loading active — fat% likely overstated')
  else if (ctx.creatineDoseG > 0 && ctx.creatineDaysOn > 0)
    flags.push('Creatine maintenance — minor BIA distortion')
  if (ctx.hoursSinceAlcohol < 24) flags.push('Alcohol within 24h — dehydration skews reading')
  if (ctx.hardTraining) flags.push('Hard training yesterday — transient inflammation')
  if (!ctx.morningReading) flags.push('Best accuracy: fasted morning, post-toilet')
  if (ctx.illnessDay) flags.push('Illness/inflammation — scale and BIA unreliable')
  if (ctx.flightDay) flags.push('Flight/sedentary day — fluid pooling in legs')
  if (ctx.highSodium || ctx.restaurantMeal)
    flags.push('High sodium likely — water retention may be elevated')
  return { reliable: flags.length === 0, flags }
}

export function calculateConfidence(params: {
  creatineRetentionKg: number
  alcoholRetentionKg: number
  glycogenRetentionKg: number
  hardTraining: boolean
  morningReading: boolean
  highSodium?: boolean
  restaurantMeal?: boolean
  flightDay?: boolean
  illnessDay?: boolean
}): { level: ConfidenceLevel; activeConfounders: number } {
  let count = 0
  if (params.creatineRetentionKg > 0) count++
  if (params.alcoholRetentionKg > 0) count++
  if (params.glycogenRetentionKg > 0) count++
  if (params.hardTraining) count++
  if (!params.morningReading) count++
  if (params.highSodium) count++
  if (params.restaurantMeal) count++
  if (params.flightDay) count++
  if (params.illnessDay) count += 2

  const level: ConfidenceLevel = count === 0 ? 'high' : count <= 2 ? 'medium' : 'low'
  return { level, activeConfounders: count }
}

export function calculateUncertaintyBand(confidence: ConfidenceLevel): {
  bandKg: number
  description: string
} {
  switch (confidence) {
    case 'high':
      return { bandKg: 0.2, description: 'All known confounders accounted for — model is reliable' }
    case 'medium':
      return { bandKg: 0.4, description: '1–2 unquantified confounders — plausible range ±0.4 kg' }
    case 'low':
      return { bandKg: 0.7, description: 'Multiple confounders present — rough estimate only (±0.7 kg)' }
  }
}

export function calculateWeightBreakdown(input: {
  scaleKg: number
  creatineDoseG: number
  creatineDaysOn: number
  creatinePostLoad?: boolean
  alcoholUnits: number
  hoursSinceAlcohol: number
  carbsG: number
  hardTraining: boolean
  morningReading: boolean
  highSodium?: boolean
  restaurantMeal?: boolean
  flightDay?: boolean
  illnessDay?: boolean
}): WeightBreakdown {
  const creatine = estimateCreatineRetention(input.creatineDoseG, input.creatineDaysOn, input.creatinePostLoad ?? false)
  const alcohol = estimateAlcoholImpact(input.alcoholUnits, input.hoursSinceAlcohol)
  const glycogen = estimateGlycogenRetention(input.carbsG)
  const sodiumKg = estimateSodiumRetention(input.highSodium ?? false, input.restaurantMeal ?? false)
  const hardTrainingKg = estimateHardTrainingRetention(input.hardTraining)
  const tanita = assessTanitaReliability(input)

  const total = creatine.retentionKg + alcohol.retentionKg + glycogen.retentionKg + sodiumKg + hardTrainingKg

  const confidence = calculateConfidence({
    creatineRetentionKg: creatine.retentionKg,
    alcoholRetentionKg: alcohol.retentionKg,
    glycogenRetentionKg: glycogen.retentionKg,
    hardTraining: input.hardTraining,
    morningReading: input.morningReading,
    highSodium: input.highSodium,
    restaurantMeal: input.restaurantMeal,
    flightDay: input.flightDay,
    illnessDay: input.illnessDay,
  })

  return {
    scaleKg: input.scaleKg,
    creatineKg: creatine.retentionKg,
    alcoholKg: alcohol.retentionKg,
    glycogenKg: glycogen.retentionKg,
    sodiumKg,
    hardTrainingKg,
    trueWeightKg: parseFloat((input.scaleKg - total).toFixed(2)),
    tanitaReliable: tanita.reliable,
    tanitaFlags: tanita.flags,
    confidence: confidence.level,
    activeConfounders: confidence.activeConfounders,
    modelVersion: TRUE_WEIGHT_MODEL_VERSION,
  }
}

export interface HistoryEntry {
  date: string
  trueWeightKg: number
  confidence: ConfidenceLevel
}

export function calculateRollingBaseline(history: HistoryEntry[]): number | null {
  if (history.length < 3) return null
  const recent = history.slice(-7)
  const DECAY = 0.85
  const latestMs = new Date(recent[recent.length - 1].date).getTime()

  let weightedSum = 0
  let totalWeight = 0

  recent.forEach((entry) => {
    const entryMs = new Date(entry.date).getTime()
    const ageInDays = (latestMs - entryMs) / 86_400_000
    const base = Math.pow(DECAY, ageInDays)
    const confMult = entry.confidence === 'high' ? 1.2 : entry.confidence === 'medium' ? 1.0 : 0.7
    const w = base * confMult
    weightedSum += entry.trueWeightKg * w
    totalWeight += w
  })

  return parseFloat((weightedSum / totalWeight).toFixed(2))
}

export function calculateDynamicBand(
  history: HistoryEntry[],
  fallbackConf: ConfidenceLevel,
): { bandKg: number; source: 'dynamic' | 'static' } {
  const recent = history.slice(-7).map((e) => e.trueWeightKg)

  if (recent.length < 5) {
    const { bandKg } = calculateUncertaintyBand(fallbackConf)
    return { bandKg, source: 'static' }
  }

  const mean = recent.reduce((s, v) => s + v, 0) / recent.length
  const variance = recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recent.length
  const stdDev = Math.sqrt(variance)
  const bandKg = parseFloat(Math.min(1.0, Math.max(0.15, stdDev * 1.5)).toFixed(2))

  return { bandKg, source: 'dynamic' }
}

export function detectOutlier(scaleKg: number, baseline: number | null, dynamicBandKg: number): boolean {
  if (baseline === null) return false
  return Math.abs(scaleKg - baseline) > dynamicBandKg * 2.5
}
