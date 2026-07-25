import { prisma } from '@/lib/db'
import { getValidAccessToken } from './oauth'

export interface GarminBodyComp {
  calendarDate?: string
  userId?: string
  weightInGrams?: number
  bodyFatPercentage?: number
  muscleMassInGrams?: number
  boneWeightInGrams?: number
}

export async function syncBodyComps(days = 30): Promise<{ ingested: number; skipped: number }> {
  const { accessToken } = await getValidAccessToken()
  const now = Math.floor(Date.now() / 1000)
  const start = now - days * 86400
  const res = await fetch(
    `https://apis.garmin.com/wellness-api/rest/bodyComps?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${now}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin bodyComps sync failed: ${res.status} ${text}`)
  }
  const data: GarminBodyComp[] = await res.json()

  let ingested = 0
  let skipped = 0
  for (const bc of data ?? []) {
    const result = await upsertBodyComp(bc)
    if (result === 'ingested') ingested++
    else skipped++
  }
  return { ingested, skipped }
}

export async function processPushedBodyComps(
  bodyComps: GarminBodyComp[],
): Promise<{ ingested: number; skipped: number }> {
  let ingested = 0
  let skipped = 0
  for (const bc of bodyComps) {
    const result = await upsertBodyComp(bc)
    if (result === 'ingested') ingested++
    else skipped++
  }
  return { ingested, skipped }
}

export async function upsertBodyComp(bc: GarminBodyComp): Promise<'ingested' | 'skipped'> {
  const date = bc.calendarDate
  if (!date || !bc.weightInGrams) return 'skipped'

  const existing = await prisma.weightEntry.findFirst({ where: { date } })

  if (existing?.source === 'manual') return 'skipped'

  const data = {
    scaleKg: bc.weightInGrams / 1000,
    bodyFatPct: bc.bodyFatPercentage ?? null,
    muscleMassKg: bc.muscleMassInGrams ? bc.muscleMassInGrams / 1000 : null,
    boneMassKg: bc.boneWeightInGrams ? bc.boneWeightInGrams / 1000 : null,
    source: 'garmin',
  }

  if (existing) {
    await prisma.weightEntry.update({ where: { id: existing.id }, data })
  } else {
    await prisma.weightEntry.create({
      data: {
        date,
        ...data,
        morningReading: true,
        tanitaReliable: true,
      },
    })
  }
  return 'ingested'
}
