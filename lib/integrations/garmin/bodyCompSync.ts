import { prisma } from '@/lib/db'

interface GarminBodyComp {
  calendarDate: string
  weightInGrams?: number
  bodyFatPercentage?: number
  muscleMassInGrams?: number
  boneWeightInGrams?: number
}

async function garminGet(path: string, accessToken: string, refreshToken: string) {
  const res = await fetch(`https://apis.garmin.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) {
    // Token refresh not implemented here — caller handles
    throw new Error('GARMIN_UNAUTHORIZED')
  }
  if (!res.ok) throw new Error(`Garmin API error ${res.status}`)
  return res.json()
}

export async function syncBodyComps(days = 30): Promise<{ ingested: number; skipped: number }> {
  const settings = await prisma.garminToken?.findFirst?.().catch(() => null)
  if (!settings) return { ingested: 0, skipped: 0 }

  const now = Math.floor(Date.now() / 1000)
  const start = now - days * 86400
  const data: GarminBodyComp[] = await garminGet(
    `/wellness-api/rest/bodyComps?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${now}`,
    (settings as any).accessToken,
    (settings as any).refreshToken,
  )

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
