import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { detectSignals, type SignalDay } from '../lib/signals/detectSignals'
import { interventionFor, interventionsFor } from '../lib/signals/interventions'
import {
  listTrials,
  resolveTrial,
  setTrialStorePathForTests,
  startTrial,
} from '../lib/signals/trialStore'
import { SIGNAL_CONFIG } from '../lib/signals/signalConfig'

function day(date: string, patch: Partial<SignalDay> = {}): SignalDay {
  return { date, ...patch }
}

describe('SIGNAL_CONFIG', () => {
  it('has unique ids covering the detector', () => {
    const ids = SIGNAL_CONFIG.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('food_coverage_drop')
    expect(ids).toContain('sleep_below_norm')
  })
})

describe('detectSignals', () => {
  it('flags weak food coverage', () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(`2026-07-${String(20 + i).padStart(2, '0')}`, { foodLogged: i < 2 }),
    )
    const hits = detectSignals(days)
    expect(hits.some(h => h.id === 'food_coverage_drop')).toBe(true)
  })

  it('does not flag food coverage when ≥4 days logged', () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(`2026-07-${String(20 + i).padStart(2, '0')}`, { foodLogged: i < 5 }),
    )
    const hits = detectSignals(days)
    expect(hits.some(h => h.id === 'food_coverage_drop')).toBe(false)
  })

  it('flags sleep under floor with enough nights', () => {
    const days = [
      day('2026-07-21', { sleepHours: 5.5 }),
      day('2026-07-22', { sleepHours: 5.0 }),
      day('2026-07-23', { sleepHours: 6.0 }),
      day('2026-07-24', { sleepHours: 7.5 }),
      day('2026-07-25', { sleepHours: 7.2 }),
    ]
    const hits = detectSignals(days)
    const sleep = hits.find(h => h.id === 'sleep_below_norm')
    expect(sleep).toBeTruthy()
    expect(sleep!.severity).toBe('high')
  })

  it('flags protein under target on logged days', () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(`2026-07-${String(20 + i).padStart(2, '0')}`, {
        foodLogged: true,
        proteinG: i < 4 ? 100 : 160,
      }),
    )
    const hits = detectSignals(days)
    expect(hits.some(h => h.id === 'protein_below_target')).toBe(true)
  })

  it('flags load spike vs prior week', () => {
    const days: SignalDay[] = []
    for (let i = 0; i < 14; i++) {
      const d = `2026-07-${String(12 + i).padStart(2, '0')}`
      days.push(day(d, { trainingLoad: i < 7 ? 100 : 200 }))
    }
    const hits = detectSignals(days)
    expect(hits.some(h => h.id === 'load_spike')).toBe(true)
  })

  it('flags load drop when prior was meaningful', () => {
    const days: SignalDay[] = []
    for (let i = 0; i < 14; i++) {
      const d = `2026-07-${String(12 + i).padStart(2, '0')}`
      days.push(day(d, { trainingLoad: i < 7 ? 200 : 40 }))
    }
    const hits = detectSignals(days)
    expect(hits.some(h => h.id === 'load_drop')).toBe(true)
  })

  it('flags elevated RHR vs prior window', () => {
    const days: SignalDay[] = []
    for (let i = 0; i < 14; i++) {
      const d = `2026-07-${String(12 + i).padStart(2, '0')}`
      days.push(day(d, { restingHr: i < 7 ? 50 : 58 }))
    }
    const hits = detectSignals(days)
    expect(hits.some(h => h.id === 'rhr_elevated')).toBe(true)
  })

  it('flags weight stall in deficit', () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      day(`2026-07-${String(16 + i).padStart(2, '0')}`, {
        energyDelta: -400,
        scaleKg: 80 + (i === 0 ? 0 : 0.05),
      }),
    )
    const hits = detectSignals(days)
    expect(hits.some(h => h.id === 'weight_stall_vs_deficit')).toBe(true)
  })

  it('returns empty for sparse / quiet series', () => {
    const hits = detectSignals([
      day('2026-07-24', { sleepHours: 8, foodLogged: true, proteinG: 180, trainingLoad: 50 }),
      day('2026-07-25', { sleepHours: 7.5, foodLogged: true, proteinG: 170, trainingLoad: 40 }),
    ])
    expect(hits.filter(h => h.id !== 'food_coverage_drop')).toEqual([])
  })

  it('flags iron_low_vs_load when ferritin below + elevated load', () => {
    const days: SignalDay[] = []
    for (let i = 0; i < 14; i++) {
      const d = `2026-07-${String(12 + i).padStart(2, '0')}`
      days.push(day(d, { trainingLoad: i < 7 ? 100 : 150 }))
    }
    const hits = detectSignals(days, {
      drawDate: '2026-07-01',
      ferritinFlag: 'below',
      panelAgeDays: 25,
    })
    const iron = hits.find(h => h.id === 'iron_low_vs_load')
    expect(iron).toBeTruthy()
    expect(iron!.severity).toBe('watch')
    expect(iron!.unknowns.some(u => /not iron deficiency/i.test(u))).toBe(true)
  })

  it('does not flag iron_low_vs_load without load elevation', () => {
    const days: SignalDay[] = []
    for (let i = 0; i < 14; i++) {
      const d = `2026-07-${String(12 + i).padStart(2, '0')}`
      days.push(day(d, { trainingLoad: 100 }))
    }
    const hits = detectSignals(days, { ferritinFlag: 'below' })
    expect(hits.some(h => h.id === 'iron_low_vs_load')).toBe(false)
  })

  it('flags thyroid_out_of_ref softly when TSH above', () => {
    const hits = detectSignals(
      [day('2026-07-25', { foodLogged: true, proteinG: 180, trainingLoad: 40 })],
      { tshFlag: 'above', drawDate: '2026-06-01' },
    )
    const th = hits.find(h => h.id === 'thyroid_out_of_ref')
    expect(th).toBeTruthy()
    expect(th!.severity).toBe('info')
    expect(th!.evidence).toMatch(/BMR unchanged/)
  })
})

describe('interventions', () => {
  it('maps every signal id to a plan', () => {
    for (const cfg of SIGNAL_CONFIG) {
      const plan = interventionFor(cfg.id)
      expect(plan.signalId).toBe(cfg.id)
      expect(plan.action.length).toBeGreaterThan(10)
      expect(plan.horizonDays).toBeGreaterThan(0)
    }
  })

  it('batch maps ids', () => {
    const plans = interventionsFor(['sleep_below_norm', 'load_spike'])
    expect(plans).toHaveLength(2)
    expect(plans[0]!.signalId).toBe('sleep_below_norm')
  })
})

describe('trialStore', () => {
  let tmp: string

  beforeEach(() => {
    tmp = path.join(os.tmpdir(), `mypens-trials-${Date.now()}.json`)
    setTrialStorePathForTests(tmp)
  })

  afterEach(() => {
    setTrialStorePathForTests(null)
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  })

  it('starts pending and resolves outcome', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0, 0)
    const row = startTrial({
      signalId: 'sleep_below_norm',
      action: 'Protect 7h floor',
      horizonDays: 7,
      now,
    })
    expect(row.startedAt).toBe('2026-07-26')
    expect(row.dueAt).toBe('2026-08-02')
    expect(row.outcome).toBe('pending')
    expect(listTrials()).toHaveLength(1)

    const done = resolveTrial(row.id, 'yes', 'Slept better')
    expect(done?.outcome).toBe('yes')
    expect(done?.notes).toBe('Slept better')
    expect(resolveTrial('missing', 'no')).toBeNull()
  })

  it('uses local calendar dates not UTC ISO near midnight', () => {
    // 2026-07-26 00:30 CEST = 2026-07-25 22:30 UTC
    const localMidnightish = new Date(2026, 6, 26, 0, 30, 0, 0)
    const row = startTrial({
      signalId: 'food_coverage_drop',
      action: 'Log meals',
      horizonDays: 3,
      now: localMidnightish,
    })
    expect(row.startedAt).toBe('2026-07-26')
    expect(localMidnightish.toISOString().slice(0, 10)).toBe('2026-07-25')
  })
})
