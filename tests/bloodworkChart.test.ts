import { describe, expect, it } from 'vitest'
import { buildBloodworkChartSeries } from '@/lib/bloodworkChart'
import { normalizeMarkerCode } from '@/lib/bloodworkFlags'

describe('normalizeMarkerCode Dutch aliases', () => {
  it('maps ferritine / ijzer / hemoglobine to stable codes', () => {
    expect(normalizeMarkerCode('ferritine')).toBe('ferritin')
    expect(normalizeMarkerCode('ijzer')).toBe('iron')
    expect(normalizeMarkerCode('hemoglobine')).toBe('hemoglobin')
    expect(normalizeMarkerCode('hdl_cholesterol')).toBe('hdl')
    expect(normalizeMarkerCode('gamma_gt')).toBe('ggt')
  })
})

describe('buildBloodworkChartSeries', () => {
  it('builds prior→latest deltas for curated markers', () => {
    const series = buildBloodworkChartSeries([
      {
        id: 'p1',
        drawDate: '2025-03-29',
        labName: 'CMA',
        markers: [
          { code: 'ferritine', label: 'Ferritine', valueNum: 238, unit: 'µg/L', refLow: 30, refHigh: 400 },
          { code: 'ijzer', label: 'Serumijzer', valueNum: 90, unit: 'µg/dL', refLow: 65, refHigh: 175 },
          { code: 'ldl', label: 'LDL', valueNum: 62, unit: 'mg/dL', refLow: null, refHigh: 115 },
        ],
      },
      {
        id: 'p2',
        drawDate: '2026-07-28',
        labName: 'CLA',
        markers: [
          { code: 'ferritin', label: 'Ferritine', valueNum: 116, unit: 'µg/L', refLow: 30, refHigh: 400 },
          { code: 'iron', label: 'Serumijzer', valueNum: 51, unit: 'µg/dL', refLow: 65, refHigh: 175 },
          { code: 'ldl', label: 'LDL', valueNum: 49, unit: 'mg/dL', refLow: null, refHigh: 115 },
        ],
      },
    ])

    const ferritin = series.find(s => s.code === 'ferritin')
    const iron = series.find(s => s.code === 'iron')
    const ldl = series.find(s => s.code === 'ldl')

    expect(ferritin?.prior).toBe(238)
    expect(ferritin?.latest).toBe(116)
    expect(ferritin?.deltaPct).toBe(-51.3)
    expect(ferritin?.latestFlag).toBe('within')

    expect(iron?.latest).toBe(51)
    expect(iron?.latestFlag).toBe('below')
    expect(iron?.deltaPct).toBe(-43.3)

    expect(ldl?.latest).toBe(49)
    expect(ldl?.deltaPct).toBe(-21)
    expect(ldl?.latestFlag).toBe('within')
  })
})
