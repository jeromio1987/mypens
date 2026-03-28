export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface WeightBreakdown {
  scaleKg: number
  creatineKg: number
  alcoholKg: number
  glycogenKg: number
  sodiumKg: number         // v3 — quantified from highSodium / restaurantMeal flags
  hardTrainingKg: number   // v3 — quantified DOMS/inflammation retention
  trueWeightKg: number
  tanitaReliable: boolean
  tanitaFlags: string[]
  confidence: ConfidenceLevel
  activeConfounders: number
}

// ── Existing retention models (v2 unchanged) ─────────────────────────────────

export function estimateCreatineRetention(doseG: number, daysOn: number) {
  if (doseG === 0 || daysOn === 0) return { retentionKg: 0, phase: 'none' }
  const isLoading = doseG >= 10
  if (isLoading) {
    const ramp = Math.min(daysOn / 7, 1)
    return { retentionKg: parseFloat((ramp * 1.0).toFixed(2)), phase: 'loading' }
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

// ── v3 — new quantified confounders ──────────────────────────────────────────

/**
 * Osmotic water retention from dietary sodium.
 * highSodium: ~300 ml from excess sodium intake.
 * restaurantMeal (without explicit highSodium): ~150 ml hidden-sodium proxy.
 * These are rough physiological estimates — same class of uncertainty as the glycogen model.
 */
export function estimateSodiumRetention(highSodium: boolean, restaurantMeal: boolean): number {
  if (highSodium) return 0.30
  if (restaurantMeal) return 0.15
  return 0
}

/**
 * Inflammatory water retention from hard training (DOMS, microdamage).
 * Typical range 0.2–0.5 kg; centre estimate 0.30 kg.
 */
export function estimateHardTrainingRetention(hardTraining: boolean): number {
  return hardTraining ? 0.30 : 0
}

// ── Tanita reliability & confidence (v2 unchanged) ───────────────────────────

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

// Static fallback — used when not enough history for dynamic band
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

// ── Main breakdown (v3 — includes sodium + hardTraining) ─────────────────────

export function calculateWeightBreakdown(input: {
  scaleKg: number
  creatineDoseG: number
  creatineDaysOn: number
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
  const creatine       = estimateCreatineRetention(input.creatineDoseG, input.creatineDaysOn)
  const alcohol        = estimateAlcoholImpact(input.alcoholUnits, input.hoursSinceAlcohol)
  const glycogen       = estimateGlycogenRetention(input.carbsG)
  const sodiumKg       = estimateSodiumRetention(input.highSodium ?? false, input.restaurantMeal ?? false)
  const hardTrainingKg = estimateHardTrainingRetention(input.hardTraining)
  const tanita         = assessTanitaReliability(input)

  const total = creatine.retentionKg + alcohol.retentionKg + glycogen.retentionKg + sodiumKg + hardTrainingKg

  const confidence = calculateConfidence({
    creatineRetentionKg: creatine.retentionKg,
    alcoholRetentionKg:  alcohol.retentionKg,
    glycogenRetentionKg: glycogen.retentionKg,
    hardTraining:    input.hardTraining,
    morningReading:  input.morningReading,
    highSodium:      input.highSodium,
    restaurantMeal:  input.restaurantMeal,
    flightDay:       input.flightDay,
    illnessDay:      input.illnessDay,
  })

  return {
    scaleKg:         input.scaleKg,
    creatineKg:      creatine.retentionKg,
    alcoholKg:       alcohol.retentionKg,
    glycogenKg:      glycogen.retentionKg,
    sodiumKg,
    hardTrainingKg,
    trueWeightKg:    parseFloat((input.scaleKg - total).toFixed(2)),
    tanitaReliable:  tanita.reliable,
    tanitaFlags:     tanita.flags,
    confidence:      confidence.level,
    activeConfounders: confidence.activeConfounders,
  }
}

// ── v3 Signal Layer — history-based trend, band, outlier ─────────────────────

export interface HistoryEntry {
  date: string
  trueWeightKg: number
  confidence: ConfidenceLevel
}

export interface TrendContext {
  baselineTrendKg: number | null      // EWMA baseline from prior entries; null if < 3 history
  dynamicBandKg: number               // volatility-based or static fallback
  dynamicBandSource: 'dynamic' | 'static'
  isOutlier: boolean                  // scale deviates > 2.5× dynamic band from baseline
}

/**
 * Exponentially-weighted moving average of true weight over the last 7 prior entries.
 * Decay factor 0.85 per day.
 * High-confidence entries weighted ×1.2; low-confidence ×0.7 — noisy days don't anchor the baseline.
 * Returns null when fewer than 3 history entries exist.
 */
export function calculateRollingBaseline(history: HistoryEntry[]): number | null {
  if (history.length < 3) return null
  const recent = history.slice(-7)
  const DECAY  = 0.85

  let weightedSum = 0
  let totalWeight = 0

  recent.forEach((entry, idx) => {
    const ageInDays = recent.length - 1 - idx
    const base      = Math.pow(DECAY, ageInDays)
    const confMult  = entry.confidence === 'high' ? 1.2 : entry.confidence === 'medium' ? 1.0 : 0.7
    const w         = base * confMult
    weightedSum    += entry.trueWeightKg * w
    totalWeight    += w
  })

  return parseFloat((weightedSum / totalWeight).toFixed(2))
}

/**
 * Uncertainty band driven by actual volatility in the last 7 entries (std dev × 1.5).
 * Clamped to [0.15, 1.0] kg.
 * Falls back to static rule-based band when fewer than 5 prior entries exist.
 */
export function calculateDynamicBand(
  history: HistoryEntry[],
  fallbackConf: ConfidenceLevel,
): { bandKg: number; source: 'dynamic' | 'static' } {
  const recent = history.slice(-7).map(e => e.trueWeightKg)

  if (recent.length < 5) {
    const { bandKg } = calculateUncertaintyBand(fallbackConf)
    return { bandKg, source: 'static' }
  }

  const mean     = recent.reduce((s, v) => s + v, 0) / recent.length
  const variance = recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recent.length
  const stdDev   = Math.sqrt(variance)
  const bandKg   = parseFloat(Math.min(1.0, Math.max(0.15, stdDev * 1.5)).toFixed(2))

  return { bandKg, source: 'dynamic' }
}

/**
 * Returns true when the scale weight deviates more than 2.5× the dynamic band from the rolling baseline.
 * Practically: flags a reading that is very unlikely to be explained by normal daily noise.
 */
export function detectOutlier(
  scaleKg: number,
  baseline: number | null,
  dynamicBandKg: number,
): boolean {
  if (baseline === null) return false
  return Math.abs(scaleKg - baseline) > dynamicBandKg * 2.5
}
