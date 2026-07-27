import { describe, expect, it } from 'vitest'
import { hrvToQuality, mapSleepSession } from '@/lib/integrations/healthconnect/sleepMapping'

describe('healthconnect sleepMapping', () => {
  it('maps a session with device-local fields', () => {
    const mapped = mapSleepSession({
      id: 'hc-1',
      startTime: '2026-07-24T22:30:00.000Z',
      endTime: '2026-07-25T06:45:00.000Z',
      date: '2026-07-25',
      bedtime: '00:30',
      wakeTime: '08:45',
      hours: 8.25,
      hrvMs: 52,
      packageName: 'com.garmin.android.apps.connectmobile',
    })
    expect(mapped).toMatchObject({
      date: '2026-07-25',
      bedtime: '00:30',
      wakeTime: '08:45',
      hours: 8.25,
      quality: 3,
      hrv: 52,
      externalId: 'hc-1',
      source: 'healthconnect',
    })
    expect(mapped?.notes).toContain('Health Connect')
  })

  it('returns null quality without HRV (never invents 3)', () => {
    expect(hrvToQuality(undefined)).toBeNull()
    expect(hrvToQuality(null)).toBeNull()
    const mapped = mapSleepSession({
      id: 'hc-no-hrv',
      startTime: '2026-07-24T22:30:00.000Z',
      endTime: '2026-07-25T06:30:00.000Z',
      date: '2026-07-25',
      bedtime: '00:30',
      wakeTime: '08:30',
      hours: 8,
    })
    expect(mapped?.quality).toBeNull()
    expect(mapped?.hrv).toBeNull()
  })

  it('duration-only sleep score when quality null', async () => {
    const { computeSleepScore } = await import('@/lib/readinessMetrics')
    const withQ = computeSleepScore(8, 3)
    const noQ = computeSleepScore(8, null)
    expect(noQ).toBe(60)
    expect(withQ).toBeGreaterThan(noQ)
  })

  it('skips invalid duration', () => {
    expect(
      mapSleepSession({
        id: 'bad',
        startTime: '2026-07-25T08:00:00.000Z',
        endTime: '2026-07-25T07:00:00.000Z',
        date: '2026-07-25',
        bedtime: '08:00',
        wakeTime: '07:00',
        hours: -1,
      }),
    ).toBeNull()
  })
})
