/**
 * Deterministic ref-range flags for bloodwork markers.
 * Educational ledger only — not diagnosis.
 */

export type RefFlag = 'below' | 'within' | 'above' | 'unknown'

export type FlaggedMarker = {
  code: string
  label: string
  flag: RefFlag
  valueNum: number | null
  refLow: number | null
  refHigh: number | null
}

/** Normalize lab label / OCR text → stable slug for hints/charts. */
const CODE_ALIASES: Record<string, string> = {
  'hba1c': 'hba1c',
  'hb a1c': 'hba1c',
  'hba1c %': 'hba1c',
  'hemoglobin a1c': 'hba1c',
  'a1c': 'hba1c',
  'ldl': 'ldl',
  'ldl-c': 'ldl',
  'ldl cholesterol': 'ldl',
  'ldl-cholesterol berekend': 'ldl',
  'hdl': 'hdl',
  'hdl-c': 'hdl',
  'hdl cholesterol': 'hdl',
  'hdl-cholesterol': 'hdl',
  'hdl_cholesterol': 'hdl',
  'triglycerides': 'triglycerides',
  'triglyceriden': 'triglycerides',
  'tg': 'triglycerides',
  'total cholesterol': 'cholesterol',
  'cholesterol': 'cholesterol',
  'cholesterol totaal': 'cholesterol',
  'cholesterol_totaal': 'cholesterol',
  'chol': 'cholesterol',
  'non-hdl': 'non_hdl',
  'non hdl': 'non_hdl',
  'non-hdl-cholesterol': 'non_hdl',
  'non_hdl_cholesterol': 'non_hdl',
  'ratio tot./hdl': 'chol_hdl_ratio',
  'ratio tot.chol./hdl-chol.': 'chol_hdl_ratio',
  'ratio chol hdl': 'chol_hdl_ratio',
  'ratio_chol_hdl': 'chol_hdl_ratio',
  'ferritin': 'ferritin',
  'ferritine': 'ferritin',
  'iron': 'iron',
  'fe': 'iron',
  'ijzer': 'iron',
  'serumijzer': 'iron',
  'serum ijzer': 'iron',
  'transferrin': 'transferrin',
  'transferrine': 'transferrin',
  'iron saturation': 'iron_saturation',
  'ijzersaturatie': 'iron_saturation',
  'tsh': 'tsh',
  'thyroid stimulating hormone': 'tsh',
  'schildklier stimulerend hormoon': 'tsh',
  'ft4': 'ft4',
  'free t4': 'ft4',
  'vrij t4': 'ft4',
  'vrije t4': 'ft4',
  'free thyroxine': 'ft4',
  'ft3': 'ft3',
  'free t3': 'ft3',
  'vrij t3': 'ft3',
  'vrije t3': 'ft3',
  'free triiodothyronine': 'ft3',
  'alt': 'alt',
  'alat': 'alt',
  'gpt': 'alt',
  'gpt alt': 'alt',
  'gpt_alt': 'alt',
  'ast': 'ast',
  'got': 'ast',
  'got ast': 'ast',
  'got_ast': 'ast',
  'ggt': 'ggt',
  'gamma gt': 'ggt',
  'gamma-gt': 'ggt',
  'gamma_gt': 'ggt',
  'y-gt': 'ggt',
  'vitamin d': 'vitamin_d',
  '25-oh vitamin d': 'vitamin_d',
  '25 oh d': 'vitamin_d',
  '25(oh)d': 'vitamin_d',
  '25-oh-vitamine d': 'vitamin_d',
  'vit d': 'vitamin_d',
  'b12': 'b12',
  'vitamin b12': 'b12',
  'vitamine b12': 'b12',
  'vitamine_b12': 'b12',
  'folate': 'folate',
  'folic acid': 'folate',
  'foliumzuur': 'folate',
  'glucose': 'glucose',
  'fasting glucose': 'glucose',
  'glucose nuchter': 'glucose',
  'nuchtere glucose': 'glucose',
  'crp': 'crp',
  'hs-crp': 'crp',
  'hscrp': 'crp',
  'creatinine': 'creatinine',
  'egfr': 'egfr',
  'egfr ckd epi': 'egfr',
  'egfr_ckd_epi': 'egfr',
  'hemoglobin': 'hemoglobin',
  'hemoglobine': 'hemoglobin',
  'hb': 'hemoglobin',
  'hematocrit': 'hematocrit',
  'hematocriet': 'hematocrit',
  'hct': 'hematocrit',
  'wbc': 'wbc',
  'leukocyten': 'wbc',
  'rbc': 'rbc',
  'erytrocyten': 'rbc',
  'erythrocytes': 'rbc',
  'platelets': 'platelets',
  'plt': 'platelets',
  'trombocyten': 'platelets',
  'testosterone': 'testosterone',
  'testosteron': 'testosterone',
  'testosteron totaal': 'testosterone',
  'cortisol': 'cortisol',
  'cortisol ochtend': 'cortisol',
  'ochtendcortisol': 'cortisol',
  'cortisol_morning': 'cortisol',
  'shbg': 'shbg',
  'testost.bind.globuline': 'shbg',
  'free testosterone': 'free_testosterone',
  'vrij testosteron': 'free_testosterone',
  'vrij testosteron berekend': 'free_testosterone',
}

export function normalizeMarkerCode(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (CODE_ALIASES[key]) return CODE_ALIASES[key]
  const slug = key.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return CODE_ALIASES[slug.replace(/_/g, ' ')] ?? (slug || 'unknown')
}

export function flagRefRange(
  valueNum: number | null | undefined,
  refLow: number | null | undefined,
  refHigh: number | null | undefined,
): RefFlag {
  if (valueNum == null || !Number.isFinite(valueNum)) return 'unknown'
  const hasLow = refLow != null && Number.isFinite(refLow)
  const hasHigh = refHigh != null && Number.isFinite(refHigh)
  if (!hasLow && !hasHigh) return 'unknown'
  if (hasLow && valueNum < (refLow as number)) return 'below'
  if (hasHigh && valueNum > (refHigh as number)) return 'above'
  return 'within'
}

export function flagMarkers(
  markers: Array<{
    code: string
    label: string
    valueNum?: number | null
    refLow?: number | null
    refHigh?: number | null
  }>,
): FlaggedMarker[] {
  return markers.map(m => ({
    code: normalizeMarkerCode(m.code || m.label),
    label: m.label,
    valueNum: m.valueNum ?? null,
    refLow: m.refLow ?? null,
    refHigh: m.refHigh ?? null,
    flag: flagRefRange(m.valueNum, m.refLow, m.refHigh),
  }))
}

export type SoftRead = {
  summary: string
  byFlag: { below: string[]; within: string[]; above: string[]; unknown: string[] }
  disclaimer: string
}

const DISCLAIMER =
  'Educational self-tracking only — not a diagnosis or medical advice. Discuss results with your clinician.'

/** Soft read: restates flags + optional longevity family titles — no diagnosis. */
export function softBloodworkRead(
  flagged: FlaggedMarker[],
  longevityTitles: string[] = [],
): SoftRead {
  const byFlag = {
    below: flagged.filter(f => f.flag === 'below').map(f => f.label),
    within: flagged.filter(f => f.flag === 'within').map(f => f.label),
    above: flagged.filter(f => f.flag === 'above').map(f => f.label),
    unknown: flagged.filter(f => f.flag === 'unknown').map(f => f.label),
  }
  const parts: string[] = []
  if (byFlag.below.length) parts.push(`Below listed ref: ${byFlag.below.join(', ')}.`)
  if (byFlag.above.length) parts.push(`Above listed ref: ${byFlag.above.join(', ')}.`)
  if (byFlag.within.length) {
    parts.push(
      byFlag.within.length <= 4
        ? `Within listed ref: ${byFlag.within.join(', ')}.`
        : `${byFlag.within.length} markers within listed ref ranges.`,
    )
  }
  if (byFlag.unknown.length && !byFlag.below.length && !byFlag.above.length && !byFlag.within.length) {
    parts.push('No numeric ref ranges to compare yet — add ref low/high when available.')
  }
  if (longevityTitles.length) {
    parts.push(`Educational families noted: ${longevityTitles.join('; ')}.`)
  }
  if (parts.length === 0) {
    parts.push('No markers flagged yet.')
  }
  return {
    summary: parts.join(' '),
    byFlag,
    disclaimer: DISCLAIMER,
  }
}

export const FLAG_CHIP: Record<RefFlag, { label: string; className: string }> = {
  below: { label: 'Below ref', className: 'bg-sky-900/40 text-sky-200 border-sky-500/30' },
  within: { label: 'In range', className: 'bg-emerald-900/30 text-emerald-200 border-emerald-500/25' },
  above: { label: 'Above ref', className: 'bg-amber-900/40 text-amber-100 border-amber-500/30' },
  unknown: { label: 'No ref', className: 'bg-pens-navy/60 text-pens-cream/50 border-pens-muted/25' },
}
