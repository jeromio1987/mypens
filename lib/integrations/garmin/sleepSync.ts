import { prisma } from '@/lib/db'
import { getValidAccessToken } from './oauth'

interface GarminDaily {
  calendarDate?: string
  userId?: string
  sleepingSeconds?: number
  avgSleepingHRV?: number
}

interface GarminSleep {
  calendarDate?: string
  userId?: string
  durationInSeconds?: number
  averageHrv?: number
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

function toDaily(summary: GarminDaily | GarminSleep): GarminDaily | null {
  if ('durationInSeconds' in summary && summary.durationInSeconds != null) {
    return {
      calendarDate: summary.calendarDate,
      userId: summary.userId,
      sleepingSeconds: summary.durationInSeconds,
      avgSleepingHRV: summary.averageHrv,
    }
  }
  const daily = summary as GarminDaily
  if (daily.sleepingSeconds != null) return daily
  return null
}

export async function syncSleep(days = 30): Promise<{ ingested: number; skipped: number }> {
  const { accessToken } = await getValidAccessToken()
  const now = Math.floor(Date.now() / 1000)
  const start = now - days * 86400
  const res = await fetch(
    `https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${now}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin dailies sync failed: ${res.status} ${text}`)
  }
  const data: GarminDaily[] = await res.json()

  // Also persist steps / Active / Resting / Total for Fuel NEAT + reconcile.
  const { processPushedDailiesWellness } = await import('./dailiesSync')
  await processPushedDailiesWellness(data ?? []).catch(err => {
    console.error('[garmin] wellness dailies persist failed', err)
  })

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
  summaries: Array<GarminDaily | GarminSleep>,
): Promise<{ ingested: number; skipped: number }> {
  let ingested = 0
  let skipped = 0
  for (const summary of summaries) {
    const daily = toDaily(summary)
    if (!daily) {
      skipped++
      continue
    }
    const result = await upsertSleepFromDaily(daily)
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
