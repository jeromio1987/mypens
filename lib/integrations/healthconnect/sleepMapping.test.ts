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
    })
    expect(mapped?.notes).toContain('Health Connect')
  })

  it('defaults quality to 3 without HRV', () => {
    expect(hrvToQuality(undefined)).toBe(3)
    expect(hrvToQuality(null)).toBe(3)
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
