import { describe, expect, it } from 'vitest'
import {
  buildWeekEnergyRecap,
  estimateBmrKcal,
  rolling7Window,
} from '../lib/energyWeek'
import { calibrateWeekVsWeight } from '../lib/energyWeightCalibration'
import { schildklierRead } from '../lib/bloodworkThyroidRead'
import { normalizeMarkerCode } from '../lib/bloodworkFlags'

describe('estimateBmrKcal', () => {
  it('uses ~22 kcal/kg', () => {
    expect(estimateBmrKcal(80)).toBe(1760)
  })
  it('returns 0 when missing', () => {
    expect(estimateBmrKcal(null)).toBe(0)
  })
})

describe('rolling7Window', () => {
  it('ends on asOf and spans 7 days', () => {
    const w = rolling7Window('2026-07-25')
    expect(w.to).toBe('2026-07-25')
    expect(w.from).toBe('2026-07-19')
    expect(w.dates).toHaveLength(7)
  })
})

describe('buildWeekEnergyRecap imputation', () => {
  it('fills 2 missing days from mean of 5 tracked', () => {
    const raw = [
      { date: '2026-07-19', foodKcal: 2000, activityKcal: 400, weightKg: 80 },
      { date: '2026-07-20', foodKcal: 2000, activityKcal: 400, weightKg: 80 },
      { date: '2026-07-21', foodKcal: 2000, activityKcal: 400, weightKg: 80 },
      { date: '2026-07-22', foodKcal: 2000, activityKcal: 400, weightKg: 80 },
      { date: '2026-07-23', foodKcal: 2000, activityKcal: 400, weightKg: 80 },
      { date: '2026-07-24', foodKcal: 0, activityKcal: 0, weightKg: 80 },
      { date: '2026-07-25', foodKcal: 0, activityKcal: 0, weightKg: 80 },
    ]
    const recap = buildWeekEnergyRecap(raw)
    expect(recap.summary.daysTracked).toBe(5)
    expect(recap.summary.daysImputed).toBe(2)
    const imputed = recap.days.filter(d => d.imputed)
    expect(imputed).toHaveLength(2)
    expect(imputed[0].foodKcal).toBe(2000)
    expect(imputed[0].activityKcal).toBe(400)
    // food 2000 - (400 + 1760) = -160 per day
    expect(recap.days[0].delta).toBe(-160)
    expect(recap.summary.weekNetKcal).toBe(-160 * 7)
  })
})

describe('calibrateWeekVsWeight', () => {
  it('compares ledger to scale delta', () => {
    // −7700 kcal → predict −1 kg; observed −0.4 → residual +0.6
    const cal = calibrateWeekVsWeight(-7700, [
      { date: '2026-07-19', scaleKg: 80 },
      { date: '2026-07-25', scaleKg: 79.6 },
    ])
    expect(cal).not.toBeNull()
    expect(cal!.predictedKg).toBe(-1)
    expect(cal!.observedKg).toBe(-0.4)
    expect(cal!.residualKg).toBe(0.6)
    expect(cal!.note).toMatch(/overstate deficit/i)
  })
  it('returns null with fewer than 2 weights', () => {
    expect(calibrateWeekVsWeight(-1000, [{ date: '2026-07-25', scaleKg: 80 }])).toBeNull()
  })
})

describe('schildklierRead', () => {
  it('normalizes Dutch vrij T4 and builds soft summary', () => {
    expect(normalizeMarkerCode('vrij T4')).toBe('ft4')
    expect(normalizeMarkerCode('Schildklier stimulerend hormoon')).toBe('tsh')
    const read = schildklierRead([
      { code: 'TSH', label: 'TSH', valueNum: 4.5, refLow: 0.3, refHigh: 4.2, unit: 'mU/L' },
      { code: 'vrij T4', label: 'Vrij T4', valueNum: 15, refLow: 12, refHigh: 22, unit: 'pmol/L' },
    ])
    expect(read.present).toBe(true)
    expect(read.title).toBe('Schildklier')
    expect(read.summary).toContain('Above listed ref: TSH')
    expect(read.summary).toContain('Within listed ref')
    expect(read.disclaimer).toMatch(/not a diagnosis/i)
  })
  it('absent when no thyroid markers', () => {
    expect(schildklierRead([{ code: 'ldl', label: 'LDL', valueNum: 3 }]).present).toBe(false)
  })
})
