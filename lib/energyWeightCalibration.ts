import { KCAL_PER_KG } from '@/lib/energyWeek'

export type WeightPoint = { date: string; scaleKg: number }

export type WeightCalibration = {
  predictedKg: number
  observedKg: number
  residualKg: number
  residualKcal: number
  weekNetKcal: number
  weightStart: WeightPoint
  weightEnd: WeightPoint
  note: string
  disclaimer: string
}

const DISCLAIMER =
  'Rough check only (~7700 kcal ≈ 1 kg). Water, glycogen, and noise dominate short windows — not a model grade.'

/**
 * Compare week net ledger kcal to scale Δkg over the same window.
 * Picks earliest and latest weight in `weights` (already filtered to window ±1 day by caller).
 */
export function calibrateWeekVsWeight(
  weekNetKcal: number,
  weights: WeightPoint[],
): WeightCalibration | null {
  if (weights.length < 2) return null
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const start = sorted[0]
  const end = sorted[sorted.length - 1]
  if (start.date === end.date) return null

  const observedKg = Math.round((end.scaleKg - start.scaleKg) * 100) / 100
  const predictedKg = Math.round((weekNetKcal / KCAL_PER_KG) * 100) / 100
  const residualKg = Math.round((observedKg - predictedKg) * 100) / 100
  const residualKcal = Math.round(residualKg * KCAL_PER_KG)

  let note: string
  if (Math.abs(residualKg) < 0.15) {
    note = 'Scale move roughly matches the week ledger (within ~0.15 kg).'
  } else if (residualKg > 0) {
    note =
      weekNetKcal < 0
        ? `Scale dropped less (or rose) vs ledger deficit — ledger may overstate deficit by ~${Math.abs(residualKcal)} kcal.`
        : `Scale rose more than ledger surplus suggests — gap ~${Math.abs(residualKcal)} kcal.`
  } else {
    note =
      weekNetKcal < 0
        ? `Scale dropped more than ledger deficit suggests — gap ~${Math.abs(residualKcal)} kcal.`
        : `Scale rose less (or fell) vs ledger surplus — ledger may overstate surplus by ~${Math.abs(residualKcal)} kcal.`
  }

  return {
    predictedKg,
    observedKg,
    residualKg,
    residualKcal,
    weekNetKcal,
    weightStart: start,
    weightEnd: end,
    note,
    disclaimer: DISCLAIMER,
  }
}
