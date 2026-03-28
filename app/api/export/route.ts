import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function toCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escape = (v: unknown): string => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const module = searchParams.get('module') ?? 'all'

    const parts: string[] = []

    if (module === 'weight' || module === 'all') {
      const entries = await prisma.weightEntry.findMany({ orderBy: { date: 'asc' } })
      const headers = ['date', 'scaleKg', 'trueWeightKg', 'bodyFatPct', 'muscleMassKg', 'boneMassKg', 'bodyWaterPct', 'visceralFat', 'creatineRetentionKg', 'alcoholRetentionKg', 'glycogenRetentionKg', 'creatineDoseG', 'creatineDaysOn', 'alcoholUnits', 'carbsG', 'hardTraining', 'morningReading', 'tanitaReliable']
      const rows = entries.map(e => [e.date, e.scaleKg, e.trueWeightKg, e.bodyFatPct, e.muscleMassKg, e.boneMassKg, e.bodyWaterPct, e.visceralFat, e.creatineRetentionKg, e.alcoholRetentionKg, e.glycogenRetentionKg, e.creatineDoseG, e.creatineDaysOn, e.alcoholUnits, e.carbsG, e.hardTraining, e.morningReading, e.tanitaReliable])
      if (module === 'all') parts.push('## WEIGHT\n' + toCSV(headers, rows))
      else parts.push(toCSV(headers, rows))
    }

    if (module === 'food' || module === 'all') {
      const entries = await prisma.foodEntry.findMany({ orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] })
      const headers = ['date', 'meal', 'name', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'notes']
      const rows = entries.map(e => [e.date, e.meal, e.name, e.kcal, e.proteinG, e.carbsG, e.fatG, e.fiberG, e.notes])
      if (module === 'all') parts.push('## FOOD\n' + toCSV(headers, rows))
      else parts.push(toCSV(headers, rows))
    }

    if (module === 'sleep' || module === 'all') {
      const entries = await prisma.sleepEntry.findMany({ orderBy: { date: 'asc' } })
      const headers = ['date', 'bedtime', 'wakeTime', 'hours', 'quality', 'hrv', 'notes']
      const rows = entries.map(e => [e.date, e.bedtime, e.wakeTime, e.hours, e.quality, e.hrv, e.notes])
      if (module === 'all') parts.push('## SLEEP\n' + toCSV(headers, rows))
      else parts.push(toCSV(headers, rows))
    }

    if (module === 'training' || module === 'all') {
      const entries = await prisma.trainingEntry.findMany({ orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] })
      const headers = ['date', 'exercise', 'sets', 'reps', 'weightKg', 'volume', 'rpe', 'notes']
      const rows = entries.map(e => [e.date, e.exercise, e.sets, e.reps, e.weightKg, e.volume, e.rpe, e.notes])
      if (module === 'all') parts.push('## TRAINING\n' + toCSV(headers, rows))
      else parts.push(toCSV(headers, rows))
    }

    if (module === 'measurements' || module === 'all') {
      const entries = await prisma.bodyMeasurement.findMany({ orderBy: { date: 'asc' } })
      const headers = ['date', 'waistCm', 'chestCm', 'hipsCm', 'leftArmCm', 'rightArmCm', 'leftThighCm', 'rightThighCm', 'neckCm', 'notes']
      const rows = entries.map(e => [e.date, e.waistCm, e.chestCm, e.hipsCm, e.leftArmCm, e.rightArmCm, e.leftThighCm, e.rightThighCm, e.neckCm, e.notes])
      if (module === 'all') parts.push('## MEASUREMENTS\n' + toCSV(headers, rows))
      else parts.push(toCSV(headers, rows))
    }

    const csv = parts.join('\n\n')
    const filename = module === 'all' ? 'my-pens-export.csv' : `my-pens-${module}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
