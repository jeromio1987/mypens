import { describe, expect, it } from 'vitest'
import {
  calendarWeek,
  rollingWindow,
  today,
  toDateStr,
} from '../lib/timeWindow'

describe('today()', () => {
  it('uses Europe/Brussels wall date, not UTC midnight slice', () => {
    // 2026-07-25 22:30 UTC = 2026-07-26 00:30 CEST — UTC date would be the 25th
    const utcEvening = new Date('2026-07-25T22:30:00.000Z')
    expect(utcEvening.toISOString().slice(0, 10)).toBe('2026-07-25')
    expect(today(utcEvening)).toBe('2026-07-26')
  })

  it('stays on the same Brussels calendar day mid-afternoon CEST', () => {
    const afternoon = new Date('2026-07-26T14:00:00.000Z') // 16:00 CEST
    expect(today(afternoon)).toBe('2026-07-26')
  })
})

describe('rollingWindow', () => {
  it('is inclusive and exactly N days', () => {
    const w = rollingWindow(7, '2026-07-25')
    expect(w).toMatchObject({
      from: '2026-07-19',
      to: '2026-07-25',
      label: 'rolling',
      days: 7,
    })
    expect(w.dates).toHaveLength(7)
    expect(w.dates[0]).toBe('2026-07-19')
    expect(w.dates[6]).toBe('2026-07-25')
  })

  it('defaults asOf to today()', () => {
    const w = rollingWindow(7)
    expect(w.to).toBe(today())
    expect(w.dates).toHaveLength(7)
    expect(w.label).toBe('rolling')
  })
})

describe('calendarWeek', () => {
  it('returns Mon–Sun containing the anchor', () => {
    // 2026-07-25 is Saturday
    const w = calendarWeek('2026-07-25')
    expect(w).toMatchObject({
      from: '2026-07-20',
      to: '2026-07-26',
      label: 'calendar',
      days: 7,
    })
    expect(w.dates).toHaveLength(7)
  })
})

describe('noon anchor survives DST-ish parse', () => {
  it('shiftDateStr stays on the intended calendar day', () => {
    // fromDateStr uses T12:00 local — toDateStr round-trips
    expect(toDateStr(new Date(2026, 6, 25, 12, 0, 0, 0))).toBe('2026-07-25')
  })
})
