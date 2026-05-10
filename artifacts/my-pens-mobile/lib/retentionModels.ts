export interface WeightInput {
  scaleKg: number
  creatineDoseG: number
  creatineDaysOn: number
  alcoholUnits: number
  hoursSinceAlcohol: number
  carbsG: number
  hardTraining: boolean
  morningReading: boolean
  highSodium: boolean
  restaurantMeal: boolean
  flightDay: boolean
  illnessDay: boolean
}

export interface WeightBreakdown {
  creatineRetentionKg: number
  alcoholRetentionKg: number
  glycogenRetentionKg: number
  trueWeightKg: number
  tanitaReliable: boolean
}

export interface HistoryEntry {
  date: string
  trueWeightKg: number
  confidence: 'high' | 'medium' | 'low'
}

export function estimateSodiumRetention(highSodium: boolean, restaurantMeal: boolean): number {
  let kg = 0
  if (highSodium) kg += 0.2
  if (restaurantMeal) kg += 0.15
  return parseFloat(kg.toFixed(2))
}

export function estimateHardTrainingRetention(hardTraining: boolean): number {
  return hardTraining ? 0.4 : 0
}

export function calculateConfidence(input: WeightInput): { level: 'high' | 'medium' | 'low' } {
  const confounders = [
    input.alcoholUnits > 3,
    input.carbsG > 300,
    input.highSodium,
    input.restaurantMeal,
    input.flightDay,
    input.illnessDay,
    input.hardTraining,
  ].filter(Boolean).length

  if (confounders === 0) return { level: 'high' }
  if (confounders <= 2) return { level: 'medium' }
  return { level: 'low' }
}

export function calculateWeightBreakdown(input: WeightInput): WeightBreakdown {
  const creatineRetentionKg =
    input.creatineDaysOn > 0
      ? parseFloat(
          Math.min(
            input.creatineDaysOn <= 5
              ? (input.creatineDoseG / 20) * 1.5 * (input.creatineDaysOn / 5)
              : input.creatineDoseG > 3
                ? 0.5
                : 0.2,
            1.5,
          ).toFixed(2),
        )
      : 0

  const alcoholRetentionKg =
    input.alcoholUnits > 0
      ? parseFloat(
          Math.min(
            (input.alcoholUnits / 5) * Math.max(0, 1 - input.hoursSinceAlcohol / 48),
            1.2,
          ).toFixed(2),
        )
      : 0

  const glycogenRetentionKg = input.carbsG > 300 ? 0.5 : input.carbsG > 200 ? 0.3 : 0

  const sodiumKg = estimateSodiumRetention(input.highSodium, input.restaurantMeal)
  const hardTrainingKg = estimateHardTrainingRetention(input.hardTraining)

  const trueWeightKg = parseFloat(
    (
      input.scaleKg -
      creatineRetentionKg -
      alcoholRetentionKg -
      glycogenRetentionKg -
      sodiumKg -
      hardTrainingKg
    ).toFixed(2),
  )

  const tanitaReliable = !input.hardTraining && !input.illnessDay && input.morningReading

  return { creatineRetentionKg, alcoholRetentionKg, glycogenRetentionKg, trueWeightKg, tanitaReliable }
}

export function calculateRollingBaseline(history: HistoryEntry[]): number | null {
  if (history.length < 3) return null
  const recent = history.slice(-7)
  const alpha = 0.3
  let ema = recent[0].trueWeightKg
  for (let i = 1; i < recent.length; i++) {
    ema = alpha * recent[i].trueWeightKg + (1 - alpha) * ema
  }
  return parseFloat(ema.toFixed(2))
}

export function calculateDynamicBand(
  history: HistoryEntry[],
  confidence: string,
): { bandKg: number; source: string } {
  if (history.length < 5) {
    const staticBand = confidence === 'high' ? 0.5 : confidence === 'medium' ? 0.8 : 1.2
    return { bandKg: staticBand, source: 'static' }
  }
  const recent = history.slice(-14)
  const weights = recent.map((e) => e.trueWeightKg)
  const mean = weights.reduce((a, b) => a + b, 0) / weights.length
  const variance = weights.reduce((acc, w) => acc + Math.pow(w - mean, 2), 0) / weights.length
  const stdDev = Math.sqrt(variance)
  return { bandKg: parseFloat((stdDev * 2).toFixed(2)), source: 'dynamic' }
}

export function detectOutlier(
  scaleKg: number,
  baseline: number | null,
  bandKg: number,
): boolean {
  if (baseline === null) return false
  return Math.abs(scaleKg - baseline) > 2.5 * bandKg
}
