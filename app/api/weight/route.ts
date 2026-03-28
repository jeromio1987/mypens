import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  calculateWeightBreakdown,
  calculateConfidence,
  calculateRollingBaseline,
  calculateDynamicBand,
  detectOutlier,
  estimateSodiumRetention,
  estimateHardTrainingRetention,
} from '@/lib/retentionModels'
import type { HistoryEntry, ConfidenceLevel } from '@/lib/retentionModels'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      date,
      scaleKg,
      creatineDoseG = 0,
      creatineDaysOn = 0,
      alcoholUnits = 0,
      hoursSinceAlcohol = 48,
      carbsG = 0,
      hardTraining = false,
      morningReading = true,
      highSodium = false,
      restaurantMeal = false,
      flightDay = false,
      illnessDay = false,
      bodyFatPct,
      muscleMassKg,
      boneMassKg,
      bodyWaterPct,
      visceralFat,
    } = body

    const breakdown = calculateWeightBreakdown({
      scaleKg,
      creatineDoseG,
      creatineDaysOn,
      alcoholUnits,
      hoursSinceAlcohol,
      carbsG,
      hardTraining,
      morningReading,
      highSodium,
      restaurantMeal,
      flightDay,
      illnessDay,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await (prisma.weightEntry.create as any)({
      data: {
        date,
        scaleKg,
        creatineDoseG,
        creatineDaysOn,
        alcoholUnits,
        hoursSinceAlcohol,
        carbsG,
        hardTraining,
        morningReading,
        highSodium,
        restaurantMeal,
        flightDay,
        illnessDay,
        bodyFatPct,
        muscleMassKg,
        boneMassKg,
        bodyWaterPct,
        visceralFat,
        creatineRetentionKg: breakdown.creatineKg,
        alcoholRetentionKg:  breakdown.alcoholKg,
        glycogenRetentionKg: breakdown.glycogenKg,
        trueWeightKg:        breakdown.trueWeightKg,
        tanitaReliable:      breakdown.tanitaReliable,
      },
    })

    return NextResponse.json({ entry, breakdown })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const existing = await prisma.weightEntry.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const merged = {
      scaleKg:           fields.scaleKg           ?? existing.scaleKg,
      creatineDoseG:     fields.creatineDoseG     ?? existing.creatineDoseG,
      creatineDaysOn:    fields.creatineDaysOn     ?? existing.creatineDaysOn,
      alcoholUnits:      fields.alcoholUnits       ?? existing.alcoholUnits,
      hoursSinceAlcohol: fields.hoursSinceAlcohol  ?? existing.hoursSinceAlcohol,
      carbsG:            fields.carbsG             ?? existing.carbsG,
      hardTraining:      fields.hardTraining       ?? existing.hardTraining,
      morningReading:    fields.morningReading     ?? existing.morningReading,
      highSodium:        fields.highSodium         ?? existing.highSodium,
      restaurantMeal:    fields.restaurantMeal     ?? existing.restaurantMeal,
      flightDay:         fields.flightDay          ?? existing.flightDay,
      illnessDay:        fields.illnessDay         ?? existing.illnessDay,
    }

    const breakdown = calculateWeightBreakdown(merged)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await (prisma.weightEntry.update as any)({
      where: { id },
      data: {
        ...merged,
        bodyFatPct:          fields.bodyFatPct    !== undefined ? fields.bodyFatPct    : existing.bodyFatPct,
        muscleMassKg:        fields.muscleMassKg  !== undefined ? fields.muscleMassKg  : existing.muscleMassKg,
        boneMassKg:          fields.boneMassKg    !== undefined ? fields.boneMassKg    : existing.boneMassKg,
        bodyWaterPct:        fields.bodyWaterPct  !== undefined ? fields.bodyWaterPct  : existing.bodyWaterPct,
        visceralFat:         fields.visceralFat   !== undefined ? fields.visceralFat   : existing.visceralFat,
        creatineRetentionKg: breakdown.creatineKg,
        alcoholRetentionKg:  breakdown.alcoholKg,
        glycogenRetentionKg: breakdown.glycogenKg,
        trueWeightKg:        breakdown.trueWeightKg,
        tanitaReliable:      breakdown.tanitaReliable,
      },
    })
    return NextResponse.json({ entry, breakdown })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Fetch ascending — we need chronological order to build rolling history
    const rawEntries = await prisma.weightEntry.findMany({
      orderBy: { date: 'asc' },
      take: 30,
    })

    // Build enriched entries with v3 trend layer.
    // We process chronologically, accumulating history before each entry (no lookahead).
    const history: HistoryEntry[] = []

    const enriched = rawEntries.map(e => {
      // Re-derive v3 true weight from stored components + on-the-fly sodium/hardTraining.
      // (These are deterministic from stored flags so no schema change needed.)
      const sodiumKg       = estimateSodiumRetention(e.highSodium, e.restaurantMeal)
      const hardTrainingKg = estimateHardTrainingRetention(e.hardTraining)
      const trueWeightKg   = parseFloat(
        (e.scaleKg - e.creatineRetentionKg - e.alcoholRetentionKg - e.glycogenRetentionKg - sodiumKg - hardTrainingKg).toFixed(2),
      )

      // Confidence (computed from stored retention values + flags)
      const confidence: ConfidenceLevel = calculateConfidence({
        creatineRetentionKg: e.creatineRetentionKg,
        alcoholRetentionKg:  e.alcoholRetentionKg,
        glycogenRetentionKg: e.glycogenRetentionKg,
        hardTraining:    e.hardTraining,
        morningReading:  e.morningReading,
        highSodium:      e.highSodium,
        restaurantMeal:  e.restaurantMeal,
        flightDay:       e.flightDay,
        illnessDay:      e.illnessDay,
      }).level

      // Trend layer — uses only prior history (strict no-lookahead)
      const baselineTrendKg                       = calculateRollingBaseline(history)
      const { bandKg: dynamicBandKg, source: dynamicBandSource } = calculateDynamicBand(history, confidence)
      const isOutlier                             = detectOutlier(e.scaleKg, baselineTrendKg, dynamicBandKg)

      // Advance history for the next entry
      history.push({ date: e.date, trueWeightKg, confidence })

      return {
        ...e,
        // Override stored v2 trueWeightKg with v3 (sodium + hardTraining included)
        trueWeightKg,
        sodiumKg,
        hardTrainingKg,
        // Trend context
        confidence,
        baselineTrendKg,
        dynamicBandKg,
        dynamicBandSource,
        isOutlier,
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
