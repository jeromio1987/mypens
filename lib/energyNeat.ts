/**
 * NEAT (non-exercise activity thermogenesis) for the day ledger.
 * Prefer Garmin/device Active residual: max(0, deviceActive − Σ sessions).
 * Else steps→kcal model. Never add both (would double-count).
 */

export type NeatSource = 'device_active_residual' | 'steps_model' | 'none'

export type NeatEstimate = {
  neatKcal: number
  source: NeatSource
  steps: number | null
  deviceActiveKcal: number | null
  sessionEatKcal: number
  detail: string
}

/** Rough steps→kcal (~0.04 kcal/step at 70 kg; scales lightly with weight). */
export const STEPS_KCAL_BASE = 0.04
export const STEPS_REF_KG = 70

export function stepsToKcal(steps: number, weightKg: number | null | undefined): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0
  const w = weightKg != null && weightKg > 0 ? weightKg : STEPS_REF_KG
  const perStep = STEPS_KCAL_BASE * (w / STEPS_REF_KG)
  return Math.round(steps * perStep)
}

/**
 * Pick one NEAT path — residual preferred when device day Active is present.
 */
export function estimateNeat(input: {
  sessionEatKcal: number
  deviceActiveKcal?: number | null
  steps?: number | null
  weightKg?: number | null
}): NeatEstimate {
  const sessionEatKcal = Math.max(0, Math.round(input.sessionEatKcal || 0))
  const deviceActive =
    input.deviceActiveKcal != null && Number.isFinite(input.deviceActiveKcal) && input.deviceActiveKcal > 0
      ? Math.round(input.deviceActiveKcal)
      : null
  const steps =
    input.steps != null && Number.isFinite(input.steps) && input.steps > 0
      ? Math.round(input.steps)
      : null

  if (deviceActive != null) {
    const residual = Math.max(0, deviceActive - sessionEatKcal)
    return {
      neatKcal: residual,
      source: 'device_active_residual',
      steps,
      deviceActiveKcal: deviceActive,
      sessionEatKcal,
      detail: `NEAT residual max(0, device Active ${deviceActive} − sessions ${sessionEatKcal})`,
    }
  }

  if (steps != null) {
    const neatKcal = stepsToKcal(steps, input.weightKg)
    return {
      neatKcal,
      source: 'steps_model',
      steps,
      deviceActiveKcal: null,
      sessionEatKcal,
      detail: `NEAT from steps (${steps.toLocaleString()} × ~${STEPS_KCAL_BASE} kcal @ ${STEPS_REF_KG} kg ref)`,
    }
  }

  return {
    neatKcal: 0,
    source: 'none',
    steps: null,
    deviceActiveKcal: null,
    sessionEatKcal,
    detail: 'NEAT unavailable (no device Active or steps)',
  }
}
