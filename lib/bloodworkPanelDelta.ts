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
  /** Set when units differ and no safe conversion — delta suppressed (B1). */
  unitMismatch?: boolean
}

/** Normalize unit strings for compatibility checks (not full UCUM). */
export function normalizeUnit(unit: string | null | undefined): string | null {
  if (unit == null) return null
  const u = unit.trim().toLowerCase().replace(/\s+/g, '')
  if (!u) return null
  const aliases: Record<string, string> = {
    'µg/l': 'ug/l',
    'ug/l': 'ug/l',
    'ng/ml': 'ng/ml',
    'mg/dl': 'mg/dl',
    'mmol/l': 'mmol/l',
    'miu/l': 'miu/l',
    'uiu/ml': 'uiu/ml',
    '%': '%',
    'g/l': 'g/l',
    'g/dl': 'g/dl',
  }
  return aliases[u] ?? u
}

function unitsCompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeUnit(a)
  const nb = normalizeUnit(b)
  // Missing unit on one side: allow (same lab often omits once) but both present must match.
  if (na == null || nb == null) return true
  return na === nb
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
    const unitOk = unitsCompatible(m.unit, prev.unit)
    const delta =
      unitOk && latestVal != null && prevVal != null
        ? Math.round((latestVal - prevVal) * 100) / 100
        : null

    let trend: MarkerDelta['trend'] = 'unknown'
    if (!unitOk && latestVal != null && prevVal != null) {
      trend = 'unknown'
    } else if (delta != null) {
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
      unit: unitOk ? (m.unit ?? prev.unit ?? null) : m.unit ?? prev.unit ?? null,
      previousFlag: flagRefRange(prevVal, prev.refLow, prev.refHigh),
      latestFlag: flagRefRange(latestVal, m.refLow, m.refHigh),
      trend,
      ...(unitOk ? {} : { unitMismatch: true }),
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
  if (d.unitMismatch) return 'unit mismatch — no Δ'
  if (d.delta == null || d.latest == null || d.previous == null) return 'no Δ'
  const u = d.unit ? ` ${d.unit}` : ''
  return `${d.previous}${u} → ${d.latest}${u} (${fmtDelta(d.delta)})`
}
