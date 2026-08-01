import { describe, expect, it } from 'vitest'
import { pickDistinctTopRisk, formatTheReadHeadline } from '@/lib/engines/cockpitData'

describe('pickDistinctTopRisk', () => {
  const cause = {
    id: 'rhr_heavy_stack',
    label: 'Very high resting HR — heavy drinking and/or other load',
  }

  it('skips the causal pattern that duplicates leadingCause (same id)', () => {
    const risk = pickDistinctTopRisk(
      [
        {
          id: 'rhr_heavy_stack',
          severity: 'high',
          title: `${cause.label} (87%)`,
        },
        {
          id: 'short_sleep_high_stress',
          severity: 'high',
          title: 'Short sleep stacked with elevated stress',
        },
      ],
      cause,
    )
    expect(risk).toBe('Short sleep stacked with elevated stress')
  })

  it('skips same label even without id', () => {
    const risk = pickDistinctTopRisk(
      [
        { severity: 'high', title: `${cause.label} (87%)` },
        { severity: 'high', title: 'Resting HR rising while HRV falls' },
      ],
      cause,
    )
    expect(risk).toBe('Resting HR rising while HRV falls')
  })

  it('returns null when every high pattern is the cause', () => {
    const risk = pickDistinctTopRisk(
      [{ id: 'rhr_heavy_stack', severity: 'high', title: `${cause.label} (87%)` }],
      cause,
    )
    expect(risk).toBeNull()
  })

  it('ignores moderate/info when looking for Risk', () => {
    const risk = pickDistinctTopRisk(
      [
        { id: 'rhr_heavy_stack', severity: 'high', title: `${cause.label} (87%)` },
        { severity: 'moderate', title: 'Higher steps track with shorter sleep' },
      ],
      cause,
    )
    expect(risk).toBeNull()
  })
})

describe('formatTheReadHeadline', () => {
  it('prefixes Form-week stretch language', () => {
    expect(formatTheReadHeadline('Latest stretch is good (2026-05-01 → 2026-07-01, ~2 mo).')).toBe(
      'Form weeks · Latest stretch is good (2026-05-01 → 2026-07-01, ~2 mo).',
    )
  })

  it('prefixes 12-month view headlines', () => {
    expect(formatTheReadHeadline('On a 12-month view: mixed (score 52/100).')).toMatch(/^Form weeks ·/)
  })

  it('does not double-prefix', () => {
    const once = formatTheReadHeadline('Latest stretch is mixed (a → b, ~1 mo).')
    expect(formatTheReadHeadline(once)).toBe(once)
  })

  it('prefixes any bare headline (not only regex-known phrasings)', () => {
    expect(formatTheReadHeadline('Quiet recovery week overall.')).toBe(
      'Form weeks · Quiet recovery week overall.',
    )
  })
})
