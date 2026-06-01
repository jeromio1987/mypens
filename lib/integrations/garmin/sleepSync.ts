import { prisma } from '@/lib/db'

interface GarminDaily {
  calendarDate: string
  sleepingSeconds?: number
  avgSleepingHRV?: number
}

function hrvToQuality(hrv?: number): number {
  if (!hrv) return 3
  if (hrv < 30) return 1
  if (hrv < 45) return 2
  if (hrv < 60) return 3
  if (hrv < 75) return 4
  return 5
}

function deriveBedtime(sleepHours: number, wakeTime = '07:00'): string {
  const [wakeH, wakeM] = wakeTime.split(':').map(Number)
  const totalMins = wakeH * 60 + wakeM - Math.round(sleepHours * 60)
  const bedMins = ((totalMins % 1440) + 1440) % 1440
  const h = String(Math.floor(bedMins / 60)).padStart(2, '0')
  const m = String(bedMins % 60).padStart(2, '0')
  return `${h}:${m}`
}

export async function syncSleep(days = 30): Promise<{ ingested: number; skipped: number }> {
  const settings = await (prisma as any).garminToken?.findFirst?.().catch(() => null)
  if (!settings) return { ingested: 0, skipped: 0 }

  const now = Math.floor(Date.now() / 1000)
  const start = now - days * 86400
  const res = await fetch(
    `https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${now}`,
    { headers: { Authorization: `Bearer ${(settings as any).accessToken}` } },
  )
  if (!res.ok) return { ingested: 0, skipped: 0 }
  const data: GarminDaily[] = await res.json()

  let ingested = 0
  let skipped = 0
  for (const d of data ?? []) {
    const result = await upsertSleepFromDaily(d)
    if (result === 'ingested') ingested++
    else skipped++
  }
  return { ingested, skipped }
}

export async function processPushedSleep(
  summaries: GarminDaily[],
): Promise<{ ingested: number; skipped: number }> {
  let ingested = 0
  let skipped = 0
  for (const d of summaries) {
    const result = await upsertSleepFromDaily(d)
    if (result === 'ingested') ingested++
    else skipped++
  }
  return { ingested, skipped }
}

export async function upsertSleepFromDaily(daily: GarminDaily): Promise<'ingested' | 'skipped'> {
  const date = daily.calendarDate
  if (!date || !daily.sleepingSeconds) return 'skipped'

  const existing = await prisma.sleepEntry.findUnique({ where: { date } })
  if (existing) return 'skipped' // manual always wins

  const hours = daily.sleepingSeconds / 3600
  const wakeTime = '07:00'
  const bedtime = deriveBedtime(hours, wakeTime)
  const quality = hrvToQuality(daily.avgSleepingHRV)

  await prisma.sleepEntry.create({
    data: {
      date,
      bedtime,
      wakeTime,
      hours: Math.round(hours * 10) / 10,
      quality,
      hrv: daily.avgSleepingHRV ?? null,
    },
  })
  return 'ingested'
}
