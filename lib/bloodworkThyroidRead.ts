import {
  flagRefRange,
  normalizeMarkerCode,
  type FlaggedMarker,
  type RefFlag,
} from '@/lib/bloodworkFlags'

export const THYROID_CODES = new Set(['tsh', 'ft4', 'ft3'])

export type ThyroidMarkerRead = {
  code: string
  label: string
  flag: RefFlag
  valueNum: number | null
  unit: string | null
}

export type SchildklierRead = {
  present: boolean
  title: string
  summary: string
  markers: ThyroidMarkerRead[]
  disclaimer: string
}

const DISCLAIMER =
  'Schildklier soft-read is educational only — not a diagnosis or treatment advice. Discuss TSH / FT4 / FT3 with your clinician.'

const LABEL: Record<string, string> = {
  tsh: 'TSH',
  ft4: 'FT4 (vrij T4)',
  ft3: 'FT3 (vrij T3)',
}

/**
 * Soft Schildklier blurb from panel markers — restates ref-range flags only.
 */
export function schildklierRead(
  markers: Array<{
    code: string
    label: string
    valueNum?: number | null
    refLow?: number | null
    refHigh?: number | null
    unit?: string | null
  }>,
): SchildklierRead {
  const thyroid: ThyroidMarkerRead[] = []
  for (const m of markers) {
    const code = normalizeMarkerCode(m.code || m.label)
    if (!THYROID_CODES.has(code)) continue
    thyroid.push({
      code,
      label: LABEL[code] || m.label,
      flag: flagRefRange(m.valueNum, m.refLow, m.refHigh),
      valueNum: m.valueNum ?? null,
      unit: m.unit ?? null,
    })
  }

  if (thyroid.length === 0) {
    return {
      present: false,
      title: 'Schildklier',
      summary: '',
      markers: [],
      disclaimer: DISCLAIMER,
    }
  }

  const byFlag = (f: RefFlag) => thyroid.filter(t => t.flag === f).map(t => t.label)
  const parts: string[] = []
  const below = byFlag('below')
  const above = byFlag('above')
  const within = byFlag('within')
  const unknown = byFlag('unknown')
  if (below.length) parts.push(`Below listed ref: ${below.join(', ')}.`)
  if (above.length) parts.push(`Above listed ref: ${above.join(', ')}.`)
  if (within.length) parts.push(`Within listed ref: ${within.join(', ')}.`)
  if (unknown.length && !below.length && !above.length && !within.length) {
    parts.push('Thyroid markers present but no numeric ref ranges to compare yet.')
  }
  if (parts.length === 0) parts.push('Thyroid markers logged.')

  return {
    present: true,
    title: 'Schildklier',
    summary: parts.join(' '),
    markers: thyroid,
    disclaimer: DISCLAIMER,
  }
}

/** Re-export flagged helper for UI chips from full panel subset. */
export function thyroidFlagged(markers: FlaggedMarker[]): FlaggedMarker[] {
  return markers.filter(m => THYROID_CODES.has(normalizeMarkerCode(m.code)))
}
