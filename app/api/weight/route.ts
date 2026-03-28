import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateWeightBreakdown } from '@/lib/retentionModels'

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
    })

    const entry = await prisma.weightEntry.create({
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
        bodyFatPct,
        muscleMassKg,
        boneMassKg,
        bodyWaterPct,
        visceralFat,
        creatineRetentionKg: breakdown.creatineKg,
        alcoholRetentionKg: breakdown.alcoholKg,
        glycogenRetentionKg: breakdown.glycogenKg,
        trueWeightKg: breakdown.trueWeightKg,
        tanitaReliable: breakdown.tanitaReliable,
      },
    })

    return NextResponse.json({ entry, breakdown })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const entries = await prisma.weightEntry.findMany({
      orderBy: { date: 'desc' },
      take: 30,
    })
    return NextResponse.json(entries)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
