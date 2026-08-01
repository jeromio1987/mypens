/**
 * Resolve day steps / active kcal when Garmin and Health Connect both write
 * (FULL-ENGINE-AUDIT D1). Prefer Garmin canonical kinds over HC side-kinds;
 * never silently last-writer-wins for the NEAT path.
 *
 * Ingest contract:
 * - Garmin sync → kind `steps` / `active_calories`
 * - HC companion → kind `steps_hc` / `active_calories_hc` (does not overwrite Garmin)
 * - Legacy HC rows may still sit on `steps` with sourceFile/raw marking healthconnect
 */

export type DayMetricRow = {
  kind: string
  valueNum: number | null | undefined
  sourceFile?: string | null
  raw?: string | null
}

export const STEPS_KINDS = ['steps', 'steps_hc'] as const
export const ACTIVE_KINDS = ['active_calories', 'active_calories_hc'] as const

function isHcProvenance(row: DayMetricRow): boolean {
  const sf = (row.sourceFile ?? '').toLowerCase()
  if (sf.includes('healthconnect') || sf === 'hc') return true
  if (!row.raw) return false
  try {
    const o = JSON.parse(row.raw) as { source?: string }
    return String(o.source ?? '').toLowerCase() === 'healthconnect'
  } catch {
    return false
  }
}

function num(row: DayMetricRow | undefined): number | null {
  if (!row || row.valueNum == null || !Number.isFinite(row.valueNum)) return null
  return Math.round(row.valueNum)
}

/**
 * Prefer Garmin `steps`, then HC `steps_hc`, then legacy HC-on-`steps`, then any `steps`.
 */
export function resolveSteps(rows: DayMetricRow[]): number | null {
  const list = rows.filter(r => r.kind === 'steps' || r.kind === 'steps_hc')
  if (!list.length) return null
  const garmin = list.find(r => r.kind === 'steps' && !isHcProvenance(r))
  if (num(garmin) != null) return num(garmin)
  const hcSide = list.find(r => r.kind === 'steps_hc')
  if (num(hcSide) != null) return num(hcSide)
  const legacyHc = list.find(r => r.kind === 'steps' && isHcProvenance(r))
  if (num(legacyHc) != null) return num(legacyHc)
  return num(list.find(r => r.kind === 'steps')) ?? num(list[0])
}

/** Prefer Garmin `active_calories`, then HC side-kind, then legacy HC-on-active. */
export function resolveActiveCalories(rows: DayMetricRow[]): number | null {
  const list = rows.filter(
    r => r.kind === 'active_calories' || r.kind === 'active_calories_hc',
  )
  if (!list.length) return null
  const garmin = list.find(r => r.kind === 'active_calories' && !isHcProvenance(r))
  if (num(garmin) != null) return num(garmin)
  const hcSide = list.find(r => r.kind === 'active_calories_hc')
  if (num(hcSide) != null) return num(hcSide)
  const legacyHc = list.find(r => r.kind === 'active_calories' && isHcProvenance(r))
  if (num(legacyHc) != null) return num(legacyHc)
  return num(list.find(r => r.kind === 'active_calories')) ?? num(list[0])
}
