/**
 * Compare two blood panels on shared marker codes (2nd-draw deltas).
 * Educational ledger only — not diagnosis or trend medical advice.
 */

import { normalizeMarkerCode, flagRefRange, type RefFlag } from '@/lib/bloodworkFlags'

export type PanelMarkerLike = {
  code: string
  label?: string | null
  valueNum?: number | null
  unit?: string | null
  refLow?: number | null
  refHigh?: number | null
}

export type MarkerDelta = {
  code: string
  label: string
  previous: number | null
  latest: number | null
  delta: number | null
  unit: string | null
  previousFlag: RefFlag
  latestFlag: RefFlag
  /** up | down | flat | unknown */
  trend: 'up' | 'down' | 'flat' | 'unknown'
}

export type PanelDeltaResult = {
  present: boolean
  sharedCount: number
  deltas: MarkerDelta[]
  /** One soft line for chips / brief — empty when no shared numeric pairs. */
  summaryLine: string
  disclaimer: string
}

const DISCLAIMER =
  'Panel-to-panel deltas are self-tracking context only — not a diagnosis or medical trend.'

function fmtDelta(n: number): string {
  const r = Math.round(n * 100) / 100
  return r > 0 ? `+${r}` : String(r)
}

/** Build per-code deltas for markers present (by normalized code) on both panels. */
export function comparePanelMarkers(
  latest: PanelMarkerLike[],
  previous: PanelMarkerLike[],
): PanelDeltaResult {
  const prevBy = new Map<string, PanelMarkerLike>()
  for (const m of previous) {
    const code = normalizeMarkerCode(m.code || m.label || '')
    if (!code || code === 'unknown') continue
    if (!prevBy.has(code)) prevBy.set(code, m)
  }

  const deltas: MarkerDelta[] = []
  for (const m of latest) {
    const code = normalizeMarkerCode(m.code || m.label || '')
    if (!code || code === 'unknown') continue
    const prev = prevBy.get(code)
    if (!prev) continue

    const latestVal = m.valueNum != null && Number.isFinite(m.valueNum) ? m.valueNum : null
    const prevVal = prev.valueNum != null && Number.isFinite(prev.valueNum) ? prev.valueNum : null
    const delta =
      latestVal != null && prevVal != null ? Math.round((latestVal - prevVal) * 100) / 100 : null

    let trend: MarkerDelta['trend'] = 'unknown'
    if (delta != null) {
      if (delta > 0) trend = 'up'
      else if (delta < 0) trend = 'down'
      else trend = 'flat'
    }

    deltas.push({
      code,
      label: (m.label || prev.label || code).trim() || code,
      previous: prevVal,
      latest: latestVal,
      delta,
      unit: m.unit ?? prev.unit ?? null,
      previousFlag: flagRefRange(prevVal, prev.refLow, prev.refHigh),
      latestFlag: flagRefRange(latestVal, m.refLow, m.refHigh),
      trend,
    })
  }

  deltas.sort((a, b) => a.label.localeCompare(b.label))

  const numeric = deltas.filter(d => d.delta != null)
  let summaryLine = ''
  if (numeric.length > 0) {
    const sample = numeric.slice(0, 3).map(d => {
      const u = d.unit ? ` ${d.unit}` : ''
      return `${d.label} ${d.previous}${u} → ${d.latest}${u} (${fmtDelta(d.delta!)})`
    })
    summaryLine =
      numeric.length <= 3
        ? sample.join(' · ')
        : `${sample.join(' · ')} · +${numeric.length - 3} more`
  }

  return {
    present: deltas.length > 0,
    sharedCount: deltas.length,
    deltas,
    summaryLine,
    disclaimer: DISCLAIMER,
  }
}

/** Chip-friendly trend label. */
export function trendChipLabel(d: MarkerDelta): string {
  if (d.delta == null || d.latest == null || d.previous == null) return 'no Δ'
  const u = d.unit ? ` ${d.unit}` : ''
  return `${d.previous}${u} → ${d.latest}${u} (${fmtDelta(d.delta)})`
}
