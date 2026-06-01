/**
 * Educational, non-prescriptive hints keyed by marker `code` slugs.
 * Roadmap item 9 — longevity / prevention *lens* (not medical scheduling).
 */

const LIPID_CODES = new Set(['ldl', 'ldl_c', 'hdl', 'hdl_c', 'chol', 'cholesterol', 'total_cholesterol', 'tg', 'triglycerides', 'apo_b', 'apob', 'lp_a', 'lpa'])
const METABOLIC_CODES = new Set(['hba1c', 'a1c', 'glucose', 'fasting_glucose', 'insulin', 'homa_ir', 'homair'])
const IRON_CODES = new Set(['ferritin', 'iron', 'fe', 'transferrin', 'tibc', 'uibc', 'saturation'])
const THYROID_CODES = new Set(['tsh', 'ft4', 'ft3', 'free_t4', 'free_t3'])
const LIVER_CODES = new Set(['alt', 'ast', 'ggt', 'alp', 'bilirubin'])
const VITAMIN_CODES = new Set(['vitamin_d', 'vit_d', '25_oh_d', 'b12', 'folate', 'folic_acid'])

export type LongevityHint = { title: string; body: string }

const DEFAULT_TAIL =
  'Intervals vary by person and clinician; use this only as a conversation prompt with your doctor — MY PENS does not schedule care.'

export function longevityHintsForCodes(codes: string[]): LongevityHint[] {
  const norm = new Set(codes.map(c => c.toLowerCase().replace(/\s+/g, '_')))
  const out: LongevityHint[] = []

  if ([...norm].some(c => LIPID_CODES.has(c))) {
    out.push({
      title: 'Lipids & cardiovascular risk',
      body: `Many adults discuss repeat lipid panels on a yearly cadence once stable; earlier repeats often follow a change in diet, weight, or new medications. ${DEFAULT_TAIL}`,
    })
  }
  if ([...norm].some(c => METABOLIC_CODES.has(c))) {
    out.push({
      title: 'Metabolic markers (glucose / HbA1c)',
      body: `Follow-up timing depends on prior values and clinician goals — from weeks (after a big change) to annual monitoring when stable. ${DEFAULT_TAIL}`,
    })
  }
  if ([...norm].some(c => IRON_CODES.has(c))) {
    out.push({
      title: 'Iron studies',
      body: `Iron markers can move with training load, inflammation, and diet; repeat timing is highly individual and may be tied to symptoms, not the calendar alone. ${DEFAULT_TAIL}`,
    })
  }
  if ([...norm].some(c => THYROID_CODES.has(c))) {
    out.push({
      title: 'Thyroid function',
      body: `After a dose change, clinicians often recheck on a defined window; stable patients may use longer intervals. ${DEFAULT_TAIL}`,
    })
  }
  if ([...norm].some(c => LIVER_CODES.has(c))) {
    out.push({
      title: 'Liver enzymes',
      body: `Short-term rechecks are common after a new supplement/medication or unusual result; long-term rhythm depends on underlying context. ${DEFAULT_TAIL}`,
    })
  }
  if ([...norm].some(c => VITAMIN_CODES.has(c))) {
    out.push({
      title: 'Vitamins (D, B12, folate)',
      body: `Re-testing after a correction protocol is typical; maintenance cadence varies widely by sun exposure, diet, absorption, and clinician preference. ${DEFAULT_TAIL}`,
    })
  }

  if (out.length === 0) {
    out.push({
      title: 'Prevention lens',
      body: `When you add common markers (lipids, metabolic, iron, thyroid, vitamins), MY PENS can surface gentle, educational “when people often discuss retesting” prompts — never a substitute for your clinician. ${DEFAULT_TAIL}`,
    })
  }

  return out
}
