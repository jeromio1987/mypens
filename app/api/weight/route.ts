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
      creatinePostLoad = false,
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

    // Input validation — catch NaN and missing required fields early
    if (!date || typeof date !== 'string') {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }
    const parsedScale = Number(scaleKg)
    if (isNaN(parsedScale) || parsedScale <= 0 || parsedScale > 500) {
      return NextResponse.json({ error: 'scaleKg must be a valid positive number' }, { status: 400 })
    }

    const breakdown = calculateWeightBreakdown({
      scaleKg: parsedScale,
      creatineDoseG:     Number(creatineDoseG)     || 0,
      creatineDaysOn:    Number(creatineDaysOn)     || 0,
      creatinePostLoad:  Boolean(creatinePostLoad),
      alcoholUnits:      Number(alcoholUnits)       || 0,
      hoursSinceAlcohol: Number(hoursSinceAlcohol)  || 48,
      carbsG:            Number(carbsG)             || 0,
      hardTraining:      Boolean(hardTraining),
      morningReading:    Boolean(morningReading),
      highSodium:        Boolean(highSodium),
      restaurantMeal:    Boolean(restaurantMeal),
      flightDay:         Boolean(flightDay),
      illnessDay:        Boolean(illnessDay),
    })

    const entry = await prisma.weightEntry.create({
      data: {
        date,
        scaleKg:           parsedScale,
        creatineDoseG:     Number(creatineDoseG)     || 0,
        creatineDaysOn:    Number(creatineDaysOn)     || 0,
        creatinePostLoad:  Boolean(creatinePostLoad),
        alcoholUnits:      Number(alcoholUnits)       || 0,
        hoursSinceAlcohol: Number(hoursSinceAlcohol)  || 48,
        carbsG:            Number(carbsG)             || 0,
        hardTraining:      Boolean(hardTraining),
        morningReading:    Boolean(morningReading),
        highSodium:        Boolean(highSodium),
        restaurantMeal:    Boolean(restaurantMeal),
        flightDay:         Boolean(flightDay),
        illnessDay:        Boolean(illnessDay),
        bodyFatPct:        bodyFatPct   != null ? Number(bodyFatPct)   : undefined,
        muscleMassKg:      muscleMassKg != null ? Number(muscleMassKg) : undefined,
        boneMassKg:        boneMassKg   != null ? Number(boneMassKg)   : undefined,
        bodyWaterPct:      bodyWaterPct != null ? Number(bodyWaterPct) : undefined,
        visceralFat:       visceralFat  != null ? Number(visceralFat)  : undefined,
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

    if (fields.scaleKg !== undefined) {
      const parsed = Number(fields.scaleKg)
      if (isNaN(parsed) || parsed <= 0 || parsed > 500) {
        return NextResponse.json({ error: 'scaleKg must be a valid positive number' }, { status: 400 })
      }
      fields.scaleKg = parsed
    }

    const merged = {
      scaleKg:           fields.scaleKg           ?? existing.scaleKg,
      creatineDoseG:     fields.creatineDoseG     ?? existing.creatineDoseG,
      creatineDaysOn:    fields.creatineDaysOn     ?? existing.creatineDaysOn,
      creatinePostLoad:  fields.creatinePostLoad  ?? existing.creatinePostLoad,
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

    const entry = await prisma.weightEntry.update({
      where: { id },
      data: {
        ...merged,
        bodyFatPct:          fields.bodyFatPct    !== undefined ? Number(fields.bodyFatPct)    : existing.bodyFatPct,
        muscleMassKg:        fields.muscleMassKg  !== undefined ? Number(fields.muscleMassKg)  : existing.muscleMassKg,
        boneMassKg:          fields.boneMassKg    !== undefined ? Number(fields.boneMassKg)    : existing.boneMassKg,
        bodyWaterPct:        fields.bodyWaterPct  !== undefined ? Number(fields.bodyWaterPct)  : existing.bodyWaterPct,
        visceralFat:         fields.visceralFat   !== undefined ? Number(fields.visceralFat)   : existing.visceralFat,
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
    // Fetch ascending — chronological order needed to build rolling history
    const rawEntries = await prisma.weightEntry.findMany({
      orderBy: { date: 'asc' },
      take: 30,
    })

    const history: HistoryEntry[] = []

    const enriched = rawEntries.map(e => {
      const sodiumKg       = estimateSodiumRetention(e.highSodium, e.restaurantMeal)
      const hardTrainingKg = estimateHardTrainingRetention(e.hardTraining)
      const trueWeightKg   = parseFloat(
        (e.scaleKg - e.creatineRetentionKg - e.alcoholRetentionKg - e.glycogenRetentionKg - sodiumKg - hardTrainingKg).toFixed(2),
      )

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

      const baselineTrendKg                         = calculateRollingBaseline(history)
      const { bandKg: dynamicBandKg, source: dynamicBandSource } = calculateDynamicBand(history, confidence)
      const isOutlier                               = detectOutlier(e.scaleKg, baselineTrendKg, dynamicBandKg)

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
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
