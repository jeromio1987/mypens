import { describe, expect, it } from 'vitest'
import { planWeek } from '../lib/planner/planWeek'

describe('planWeek', () => {
  it('places exactly one long session on Saturday by default', () => {
    const plan = planWeek('2026-07-20', {
      kind: 'marathon',
      label: 'Marathon build',
      longDay: 'saturday',
      sports: ['running', 'core'],
    })
    const longs = plan.days.filter(d => d.isLong)
    expect(longs).toHaveLength(1)
    expect(longs[0].weekday).toBe('Saturday')
    expect(longs[0].sport).toBe('running')
  })

  it('can lock long session to Sunday', () => {
    const plan = planWeek('2026-07-20', {
      kind: 'vo2max',
      label: 'VO2max to 50',
      targetNum: 50,
      longDay: 'sunday',
      sports: ['running', 'cycling', 'gym'],
    })
    expect(plan.days.find(d => d.isLong)?.weekday).toBe('Sunday')
  })

  it('forces easy/rest early week when recovery compromised', () => {
    const plan = planWeek(
      '2026-07-20',
      { kind: 'bodyfat', label: '13% BF hold muscle', sports: ['gym', 'core'] },
      { avgSleepHours: 5.5, sessionsBySport: { gym: 4 }, recoveryCompromised: true },
    )
    expect(plan.days[0].intensity).toBe('rest')
    expect(plan.notes.some(n => /compromised/i.test(n))).toBe(true)
  })

  it('biases gym for bodyfat goal', () => {
    const plan = planWeek('2026-07-20', {
      kind: 'bodyfat',
      label: '13% body fat',
      sports: ['gym', 'running', 'core'],
    })
    const gymDays = plan.days.filter(d => d.sport === 'gym')
    expect(gymDays.length).toBeGreaterThanOrEqual(2)
  })

  it('softens quality and notes when daily kcal is very low (6-D)', () => {
    const plan = planWeek(
      '2026-07-20',
      {
        kind: 'vo2max',
        label: 'VO2max',
        longDay: 'saturday',
        sports: ['running', 'cycling', 'gym'],
      },
      {
        avgSleepHours: 7.5,
        sessionsBySport: { running: 3 },
        avgKcal: 1400,
        avgProteinG: 120,
        foodDaysLogged: 10,
        foodWindowDays: 14,
      },
    )
    expect(plan.notes.some(n => /kcal/i.test(n))).toBe(true)
    const qualityLeft = plan.days.filter(d => d.intensity === 'quality')
    expect(qualityLeft).toHaveLength(0)
    const long = plan.days.find(d => d.isLong)
    expect(long?.minutes).toBeLessThan(80)
  })

  it('does not block the plan when food logs are missing (6-D)', () => {
    const plan = planWeek(
      '2026-07-20',
      { kind: 'marathon', label: 'Marathon', sports: ['running', 'core'] },
      {
        avgSleepHours: 7,
        sessionsBySport: {},
        avgKcal: null,
        avgProteinG: null,
        foodDaysLogged: 0,
        foodWindowDays: 14,
      },
    )
    expect(plan.days.filter(d => d.isLong)).toHaveLength(1)
    expect(plan.notes.some(n => /Fueling unknown/i.test(n))).toBe(true)
  })
})
