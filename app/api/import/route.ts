import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateWeightBreakdown } from '@/lib/retentionModels'

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('##'))
  if (lines.length < 2) return { headers: [], rows: [] }

  const splitLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current); current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  const headers = splitLine(lines[0]).map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    const vals = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  })
  return { headers, rows }
}

function detectModule(headers: string[]): string | null {
  const h = new Set(headers)
  if (h.has('scaleKg') || h.has('trueWeightKg')) return 'weight'
  if (h.has('kcal') && h.has('proteinG')) return 'food'
  if (h.has('bedtime') && h.has('wakeTime')) return 'sleep'
  if (h.has('exercise') && h.has('sets')) return 'training'
  if (h.has('waistCm') || h.has('chestCm')) return 'measurements'
  return null
}

function str(v: string | undefined): string | null { return v && v.length ? v : null }
function num(v: string | undefined): number | null { const n = parseFloat(v ?? ''); return isNaN(n) ? null : n }
function int(v: string | undefined): number | null { const n = parseInt(v ?? ''); return isNaN(n) ? null : n }
function bool(v: string | undefined): boolean { return v === 'true' || v === '1' }

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const text = await (file as Blob).text()
    const { headers, rows } = parseCSV(text)
    if (!headers.length || !rows.length) {
      return NextResponse.json({ error: 'CSV appears empty or has no data rows' }, { status: 400 })
    }

    const module = detectModule(headers)
    if (!module) {
      return NextResponse.json({ error: 'Could not detect module from CSV headers. Expected headers for weight, food, sleep, training, or measurements.' }, { status: 400 })
    }

    let inserted = 0
    let skipped = 0

    if (module === 'weight') {
      for (const row of rows) {
        if (!row.date || !row.scaleKg) { skipped++; continue }
        const scaleKg = num(row.scaleKg)
        if (scaleKg == null) { skipped++; continue }

        const creatineDoseG = num(row.creatineDoseG) ?? 0
        const creatineDaysOn = int(row.creatineDaysOn) ?? 0
        const alcoholUnits = num(row.alcoholUnits) ?? 0
        const hoursSinceAlcohol = num(row.hoursSinceAlcohol) ?? 48
        const carbsG = num(row.carbsG) ?? 0
        const hardTraining = bool(row.hardTraining)
        const morningReading = row.morningReading !== undefined ? bool(row.morningReading) : true
        const highSodium = bool(row.highSodium)
        const restaurantMeal = bool(row.restaurantMeal)
        const flightDay = bool(row.flightDay)
        const illnessDay = bool(row.illnessDay)

        const breakdown = calculateWeightBreakdown({
          scaleKg, creatineDoseG, creatineDaysOn, alcoholUnits,
          hoursSinceAlcohol, carbsG, hardTraining, morningReading,
          highSodium, restaurantMeal, flightDay, illnessDay,
        })

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma.weightEntry.create as any)({
            data: {
              date: row.date,
              scaleKg,
              bodyFatPct: num(row.bodyFatPct),
              muscleMassKg: num(row.muscleMassKg),
              boneMassKg: num(row.boneMassKg),
              bodyWaterPct: num(row.bodyWaterPct),
              visceralFat: int(row.visceralFat),
              creatineDoseG, creatineDaysOn, alcoholUnits,
              hoursSinceAlcohol, carbsG, hardTraining, morningReading,
              highSodium, restaurantMeal, flightDay, illnessDay,
              creatineRetentionKg: breakdown.creatineKg,
              alcoholRetentionKg: breakdown.alcoholKg,
              glycogenRetentionKg: breakdown.glycogenKg,
              trueWeightKg: breakdown.trueWeightKg,
              tanitaReliable: breakdown.tanitaReliable,
            },
          })
          inserted++
        } catch { skipped++ }
      }
    }

    if (module === 'food') {
      for (const row of rows) {
        if (!row.date || !row.name) { skipped++; continue }
        try {
          await prisma.foodEntry.create({
            data: {
              date: row.date,
              meal: row.meal || 'snack',
              name: row.name,
              kcal: num(row.kcal) ?? 0,
              proteinG: num(row.proteinG) ?? 0,
              carbsG: num(row.carbsG) ?? 0,
              fatG: num(row.fatG) ?? 0,
              fiberG: num(row.fiberG) ?? 0,
              notes: str(row.notes),
            },
          })
          inserted++
        } catch { skipped++ }
      }
    }

    if (module === 'sleep') {
      for (const row of rows) {
        if (!row.date || !row.bedtime || !row.wakeTime) { skipped++; continue }
        const hours = num(row.hours) ?? 0
        const quality = int(row.quality) ?? 3
        try {
          await prisma.sleepEntry.upsert({
            where: { date: row.date },
            update: { bedtime: row.bedtime, wakeTime: row.wakeTime, hours, quality, hrv: num(row.hrv), notes: str(row.notes) },
            create: { date: row.date, bedtime: row.bedtime, wakeTime: row.wakeTime, hours, quality, hrv: num(row.hrv), notes: str(row.notes) },
          })
          inserted++
        } catch { skipped++ }
      }
    }

    if (module === 'training') {
      for (const row of rows) {
        if (!row.date || !row.exercise) { skipped++; continue }
        const sets = int(row.sets) ?? 1
        const reps = int(row.reps) ?? 0
        const weightKg = num(row.weightKg) ?? 0
        const volume = num(row.volume) ?? sets * reps * weightKg
        try {
          await prisma.trainingEntry.create({
            data: {
              date: row.date,
              exercise: row.exercise,
              sets, reps, weightKg, volume,
              rpe: int(row.rpe),
              notes: str(row.notes),
            },
          })
          inserted++
        } catch { skipped++ }
      }
    }

    if (module === 'measurements') {
      for (const row of rows) {
        if (!row.date) { skipped++; continue }
        try {
          await prisma.bodyMeasurement.upsert({
            where: { date: row.date },
            update: {
              waistCm: num(row.waistCm), chestCm: num(row.chestCm),
              hipsCm: num(row.hipsCm), leftArmCm: num(row.leftArmCm),
              rightArmCm: num(row.rightArmCm), leftThighCm: num(row.leftThighCm),
              rightThighCm: num(row.rightThighCm), neckCm: num(row.neckCm),
              notes: str(row.notes),
            },
            create: {
              date: row.date,
              waistCm: num(row.waistCm), chestCm: num(row.chestCm),
              hipsCm: num(row.hipsCm), leftArmCm: num(row.leftArmCm),
              rightArmCm: num(row.rightArmCm), leftThighCm: num(row.leftThighCm),
              rightThighCm: num(row.rightThighCm), neckCm: num(row.neckCm),
              notes: str(row.notes),
            },
          })
          inserted++
        } catch { skipped++ }
      }
    }

    return NextResponse.json({ module, inserted, skipped, total: rows.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
