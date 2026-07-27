import {
  estimateSodiumRetention,
  estimateHardTrainingRetention,
  calculateConfidence,
  calculateRollingBaseline,
  calculateDynamicBand,
  detectOutlier,
  TRUE_WEIGHT_MODEL_VERSION,
  type ConfidenceLevel,
  type HistoryEntry,
} from './retentionModels'

/** Mirrors Prisma `WeightEntry` fields used for GET /api/weight enrichment. */
export type WeightRow = {
  id: string
  date: string
  scaleKg: number
  creatineRetentionKg: number
  alcoholRetentionKg: number
  glycogenRetentionKg: number
  hardTraining: boolean
  morningReading: boolean
  highSodium: boolean
  restaurantMeal: boolean
  flightDay: boolean
  illnessDay: boolean
  creatineDoseG: number
  creatineDaysOn: number
  creatinePostLoad?: boolean
  alcoholUnits: number
  hoursSinceAlcohol: number
  carbsG: number
  trueWeightKg?: number
  tanitaReliable: boolean
  bodyFatPct?: number | null
  muscleMassKg?: number | null
  boneMassKg?: number | null
  bodyWaterPct?: number | null
  visceralFat?: number | null
}

export type EnrichedWeightRow = WeightRow & {
  trueWeightKg: number
  sodiumKg: number
  hardTrainingKg: number
  confidence: ConfidenceLevel
  baselineTrendKg: number | null
  dynamicBandKg: number
  dynamicBandSource: 'dynamic' | 'static'
  isOutlier: boolean
  modelVersion: typeof TRUE_WEIGHT_MODEL_VERSION
}

export function enrichWeightSeriesFromRows(rawEntries: WeightRow[]): EnrichedWeightRow[] {
  const history: HistoryEntry[] = []

  return rawEntries.map((e) => {
    const sodiumKg = estimateSodiumRetention(e.highSodium, e.restaurantMeal)
    const hardTrainingKg = estimateHardTrainingRetention(e.hardTraining)
    const trueWeightKg = parseFloat(
      (
        e.scaleKg -
        e.creatineRetentionKg -
        e.alcoholRetentionKg -
        e.glycogenRetentionKg -
        sodiumKg -
        hardTrainingKg
      ).toFixed(2),
    )

    const confidence: ConfidenceLevel = calculateConfidence({
      creatineRetentionKg: e.creatineRetentionKg,
      alcoholRetentionKg: e.alcoholRetentionKg,
      glycogenRetentionKg: e.glycogenRetentionKg,
      hardTraining: e.hardTraining,
      morningReading: e.morningReading,
      highSodium: e.highSodium,
      restaurantMeal: e.restaurantMeal,
      flightDay: e.flightDay,
      illnessDay: e.illnessDay,
    }).level

    const baselineTrendKg = calculateRollingBaseline(history)
    const { bandKg: dynamicBandKg, source: dynamicBandSource } = calculateDynamicBand(history, confidence)
    const isOutlier = detectOutlier(e.scaleKg, baselineTrendKg, dynamicBandKg)

    history.push({ date: e.date, trueWeightKg, confidence })

    return {
      ...e,
      trueWeightKg,
      sodiumKg,
      hardTrainingKg,
      confidence,
      baselineTrendKg,
      dynamicBandKg,
      dynamicBandSource,
      isOutlier,
      modelVersion: TRUE_WEIGHT_MODEL_VERSION,
    }
  })
}
