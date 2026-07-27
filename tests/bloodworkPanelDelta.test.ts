import { describe, expect, it } from 'vitest'
import { comparePanelMarkers, trendChipLabel } from '../lib/bloodworkPanelDelta'
import { foodCoverageNudge, FOOD_COVERAGE_MIN_DAYS } from '../lib/foodCoverageNudge'
import { normalizeMarkerCode } from '../lib/bloodworkFlags'

describe('comparePanelMarkers', () => {
  it('computes shared-code deltas with trend', () => {
    const result = comparePanelMarkers(
      [
        { code: 'ferritin', label: 'Ferritin', valueNum: 62, unit: 'µg/L', refLow: 30, refHigh: 400 },
        { code: 'tsh', label: 'TSH', valueNum: 2.1, unit: 'mIU/L', refLow: 0.4, refHigh: 4.0 },
        { code: 'glucose', label: 'Glucose', valueNum: 5.2 },
      ],
      [
        { code: 'Ferritin', label: 'Ferritin', valueNum: 45, unit: 'µg/L', refLow: 30, refHigh: 400 },
        { code: 'TSH', label: 'TSH', valueNum: 2.1, unit: 'mIU/L', refLow: 0.4, refHigh: 4.0 },
        { code: 'alt', label: 'ALT', valueNum: 22 },
      ],
    )
    expect(result.present).toBe(true)
    expect(result.sharedCount).toBe(2)
    const ferritin = result.deltas.find(d => d.code === 'ferritin')
    expect(ferritin?.previous).toBe(45)
    expect(ferritin?.latest).toBe(62)
    expect(ferritin?.delta).toBe(17)
    expect(ferritin?.trend).toBe('up')
    expect(trendChipLabel(ferritin!)).toContain('45')
    expect(trendChipLabel(ferritin!)).toContain('+17')
    const tsh = result.deltas.find(d => d.code === 'tsh')
    expect(tsh?.trend).toBe('flat')
    expect(result.summaryLine).toMatch(/Ferritin/)
  })

  it('normalizes codes via aliases', () => {
    expect(normalizeMarkerCode('25-OH Vitamin D')).toBe('vitamin_d')
    const result = comparePanelMarkers(
      [{ code: 'Vit D', label: 'Vitamin D', valueNum: 80 }],
      [{ code: '25(OH)D', label: '25-OH D', valueNum: 55 }],
    )
    expect(result.sharedCount).toBe(1)
    expect(result.deltas[0]?.code).toBe('vitamin_d')
    expect(result.deltas[0]?.delta).toBe(25)
  })

  it('returns empty when no shared codes', () => {
    const result = comparePanelMarkers(
      [{ code: 'ferritin', valueNum: 50 }],
      [{ code: 'tsh', valueNum: 1 }],
    )
    expect(result.present).toBe(false)
    expect(result.summaryLine).toBe('')
  })
})

describe('foodCoverageNudge', () => {
  it('flags thin coverage below min days', () => {
    const n = foodCoverageNudge(2, 7)
    expect(n.thin).toBe(true)
    expect(n.loggedDays).toBe(2)
    expect(n.message).toMatch(/Coverage thin/)
    expect(n.message).toMatch(/2\/7/)
  })

  it('is fine at min floor', () => {
    const n = foodCoverageNudge(FOOD_COVERAGE_MIN_DAYS, 7)
    expect(n.thin).toBe(false)
    expect(n.message).toBeNull()
  })
})
