/**
 * Multi-draw bloodwork chart series (ref-band + prior→latest).
 * Educational ledger only — not diagnosis.
 */

import { prisma } from '@/lib/db'
import {
  flagRefRange,
  normalizeMarkerCode,
  type RefFlag,
} from '@/lib/bloodworkFlags'

export type BloodworkChartPoint = {
  drawDate: string
  panelId: string
  labName: string | null
  value: number
  unit: string | null
  refLow: number | null
  refHigh: number | null
  flag: RefFlag
}

export type BloodworkChartSeries = {
  code: string
  label: string
  unit: string | null
  refLow: number | null
  refHigh: number | null
  group: string
  points: BloodworkChartPoint[]
  prior: number | null
  latest: number | null
  deltaPct: number | null
  latestFlag: RefFlag
}

export type BloodworkChartPayload = {
  panels: Array<{
    id: string
    drawDate: string
    labName: string | null
    markerCount: number
  }>
  series: BloodworkChartSeries[]
  disclaimer: string
}

/** Preferred display order — matches vitaliteitsrapport focus rows. */
export const BLOODWORK_CHART_CODES: Array<{ code: string; group: string }> = [
  { code: 'ldl', group: 'Lipids' },
  { code: 'hdl', group: 'Lipids' },
  { code: 'triglycerides', group: 'Lipids' },
  { code: 'cholesterol', group: 'Lipids' },
  { code: 'non_hdl', group: 'Lipids' },
  { code: 'chol_hdl_ratio', group: 'Lipids' },
  { code: 'ggt', group: 'Liver & kidney' },
  { code: 'alt', group: 'Liver & kidney' },
  { code: 'ast', group: 'Liver & kidney' },
  { code: 'creatinine', group: 'Liver & kidney' },
  { code: 'egfr', group: 'Liver & kidney' },
  { code: 'glucose', group: 'Metabolic' },
  { code: 'crp', group: 'Metabolic' },
  { code: 'iron', group: 'Iron & vitamins' },
  { code: 'ferritin', group: 'Iron & vitamins' },
  { code: 'iron_saturation', group: 'Iron & vitamins' },
  { code: 'transferrin', group: 'Iron & vitamins' },
  { code: 'b12', group: 'Iron & vitamins' },
  { code: 'folate', group: 'Iron & vitamins' },
  { code: 'vitamin_d', group: 'Iron & vitamins' },
  { code: 'hemoglobin', group: 'Hematology' },
  { code: 'hematocrit', group: 'Hematology' },
  { code: 'rbc', group: 'Hematology' },
  { code: 'wbc', group: 'Hematology' },
  { code: 'platelets', group: 'Hematology' },
  { code: 'testosterone', group: 'Hormones' },
  { code: 'cortisol', group: 'Hormones' },
  { code: 'tsh', group: 'Hormones' },
  { code: 'ft4', group: 'Hormones' },
  { code: 'free_testosterone', group: 'Hormones' },
  { code: 'shbg', group: 'Hormones' },
]

const LABEL_FALLBACK: Record<string, string> = {
  ldl: 'LDL cholesterol',
  hdl: 'HDL cholesterol',
  triglycerides: 'Triglycerides',
  cholesterol: 'Total cholesterol',
  non_hdl: 'Non-HDL cholesterol',
  chol_hdl_ratio: 'Total / HDL ratio',
  ggt: 'Gamma-GT',
  alt: 'ALT',
  ast: 'AST',
  creatinine: 'Creatinine',
  egfr: 'eGFR',
  glucose: 'Fasting glucose',
  crp: 'CRP',
  iron: 'Serum iron',
  ferritin: 'Ferritin',
  iron_saturation: 'Iron saturation',
  transferrin: 'Transferrin',
  b12: 'Vitamin B12',
  folate: 'Folate',
  vitamin_d: '25-OH vitamin D',
  hemoglobin: 'Hemoglobin',
  hematocrit: 'Hematocrit',
  rbc: 'RBC',
  wbc: 'WBC',
  platelets: 'Platelets',
  testosterone: 'Total testosterone',
  cortisol: 'Morning cortisol',
  tsh: 'TSH',
  ft4: 'FT4',
  free_testosterone: 'Free testosterone',
  shbg: 'SHBG',
}

function deltaPct(prior: number, latest: number): number | null {
  if (!Number.isFinite(prior) || !Number.isFinite(latest) || prior === 0) return null
  return Math.round(((latest - prior) / Math.abs(prior)) * 1000) / 10
}

export function buildBloodworkChartSeries(
  panels: Array<{
    id: string
    drawDate: string
    labName: string | null
    markers: Array<{
      code: string
      label: string
      valueNum: number | null
      unit: string | null
      refLow: number | null
      refHigh: number | null
    }>
  }>,
  preferredCodes: Array<{ code: string; group: string }> = BLOODWORK_CHART_CODES,
): BloodworkChartSeries[] {
  const byCode = new Map<
    string,
    {
      label: string
      unit: string | null
      refLow: number | null
      refHigh: number | null
      points: BloodworkChartPoint[]
    }
  >()

  const chronological = [...panels].sort((a, b) => a.drawDate.localeCompare(b.drawDate))

  for (const panel of chronological) {
    for (const m of panel.markers) {
      if (m.valueNum == null || !Number.isFinite(m.valueNum)) continue
      const code = normalizeMarkerCode(m.code || m.label)
      if (!code || code === 'unknown') continue
      const flag = flagRefRange(m.valueNum, m.refLow, m.refHigh)
      const point: BloodworkChartPoint = {
        drawDate: panel.drawDate,
        panelId: panel.id,
        labName: panel.labName,
        value: m.valueNum,
        unit: m.unit,
        refLow: m.refLow,
        refHigh: m.refHigh,
        flag,
      }
      const existing = byCode.get(code)
      if (!existing) {
        byCode.set(code, {
          label: m.label || LABEL_FALLBACK[code] || code,
          unit: m.unit,
          refLow: m.refLow,
          refHigh: m.refHigh,
          points: [point],
        })
      } else {
        // Prefer newest label/unit/refs when present
        existing.label = m.label || existing.label
        existing.unit = m.unit ?? existing.unit
        existing.refLow = m.refLow ?? existing.refLow
        existing.refHigh = m.refHigh ?? existing.refHigh
        existing.points.push(point)
      }
    }
  }

  const preferredOrder = new Map(preferredCodes.map((c, i) => [c.code, { i, group: c.group }]))
  const series: BloodworkChartSeries[] = []

  for (const [code, row] of byCode) {
    const pref = preferredOrder.get(code)
    if (!pref) continue // chart shows curated markers only
    const points = row.points
    const prior = points.length >= 2 ? points[0]!.value : points[0]?.value ?? null
    const latest = points.length >= 1 ? points[points.length - 1]!.value : null
    const priorForDelta = points.length >= 2 ? points[points.length - 2]!.value : null
    const latestFlag =
      points.length >= 1
        ? points[points.length - 1]!.flag
        : ('unknown' as RefFlag)

    series.push({
      code,
      label: LABEL_FALLBACK[code] ?? row.label,
      unit: row.unit,
      refLow: row.refLow,
      refHigh: row.refHigh,
      group: pref.group,
      points,
      prior: points.length >= 2 ? priorForDelta : prior,
      latest,
      deltaPct:
        priorForDelta != null && latest != null ? deltaPct(priorForDelta, latest) : null,
      latestFlag,
    })
  }

  series.sort((a, b) => {
    const ai = preferredOrder.get(a.code)?.i ?? 999
    const bi = preferredOrder.get(b.code)?.i ?? 999
    return ai - bi
  })

  return series
}

export async function loadBloodworkChart(): Promise<BloodworkChartPayload> {
  const panels = await prisma.bloodworkPanel.findMany({
    orderBy: { drawDate: 'asc' },
    include: {
      markers: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { markers: true } },
    },
  })

  const series = buildBloodworkChartSeries(
    panels.map(p => ({
      id: p.id,
      drawDate: p.drawDate,
      labName: p.labName,
      markers: p.markers,
    })),
  )

  return {
    panels: [...panels]
      .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
      .map(p => ({
        id: p.id,
        drawDate: p.drawDate,
        labName: p.labName,
        markerCount: p._count.markers,
      })),
    series,
    disclaimer:
      'Educational self-tracking only — not a diagnosis or medical advice. Discuss results with your clinician.',
  }
}
