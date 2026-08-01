import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeTanitaCsv } from '@/lib/tanitaCsv'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

/** Web session only — rejects mobile bearer (Tanita import is web dashboard only). */
async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies()
  const session = jar.get(SESSION_COOKIE)?.value
  if (!(await verifySessionToken(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function POST(request: Request) {
  const auth = await requireSession()
  if (auth) return auth
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const modeRaw = formData.get('mode')
    const mode = modeRaw === 'overwrite' ? 'overwrite' : 'skip'

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const text = await (file as Blob).text()
    const { headers, parsed: dataRows, errors } = analyzeTanitaCsv(text)

    if (!headers.length) {
      return NextResponse.json(
        { imported: 0, skipped: 0, errors: ['CSV appears empty or has no header row.'] },
        { status: 400 },
      )
    }

    if (!dataRows.length && errors.length) {
      return NextResponse.json({ imported: 0, skipped: 0, errors }, { status: 400 })
    }

    let imported = 0
    let skipped = 0

    for (const pr of dataRows) {
      const existing = await prisma.weightEntry.findFirst({
        where: { date: pr.date },
        orderBy: { createdAt: 'desc' },
      })

      if (mode === 'skip' && existing) {
        skipped++
        continue
      }

      if (mode === 'overwrite' && existing) {
        const data: {
          scaleKg: number
          trueWeightKg: number
          tanitaReliable: boolean
          bodyFatPct?: number | null
          muscleMassKg?: number | null
          boneMassKg?: number | null
          bodyWaterPct?: number | null
          visceralFat?: number | null
        } = {
          scaleKg: pr.scaleKg,
          trueWeightKg: pr.scaleKg,
          tanitaReliable: true,
        }
        if (pr.bodyFatPct != null) data.bodyFatPct = pr.bodyFatPct
        if (pr.muscleMassKg != null) data.muscleMassKg = pr.muscleMassKg
        if (pr.boneMassKg != null) data.boneMassKg = pr.boneMassKg
        if (pr.bodyWaterPct != null) data.bodyWaterPct = pr.bodyWaterPct
        if (pr.visceralFat != null) data.visceralFat = pr.visceralFat

        try {
          await prisma.weightEntry.update({
            where: { id: existing.id },
            data,
          })
          imported++
        } catch {
          errors.push(`Row ${pr.rowNumber}: failed to update ${pr.date}.`)
          skipped++
        }
        continue
      }

      try {
        await prisma.weightEntry.create({
          data: {
            date: pr.date,
            scaleKg: pr.scaleKg,
            bodyFatPct: pr.bodyFatPct ?? undefined,
            muscleMassKg: pr.muscleMassKg ?? undefined,
            boneMassKg: pr.boneMassKg ?? undefined,
            bodyWaterPct: pr.bodyWaterPct ?? undefined,
            visceralFat: pr.visceralFat ?? undefined,
            creatineDoseG: 0,
            creatineDaysOn: 0,
            creatinePostLoad: false,
            alcoholUnits: 0,
            hoursSinceAlcohol: 48,
            carbsG: 0,
            hardTraining: false,
            morningReading: true,
            highSodium: false,
            restaurantMeal: false,
            flightDay: false,
            illnessDay: false,
            creatineRetentionKg: 0,
            alcoholRetentionKg: 0,
            glycogenRetentionKg: 0,
            trueWeightKg: pr.scaleKg,
            tanitaReliable: true,
          },
        })
        imported++
      } catch {
        errors.push(`Row ${pr.rowNumber}: failed to insert ${pr.date}.`)
        skipped++
      }
    }

    return NextResponse.json({ imported, skipped, errors })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { imported: 0, skipped: 0, errors: ['Import failed (server error).'] },
      { status: 500 },
    )
  }
}
