/**
 * NEAT (non-exercise activity thermogenesis) for the day ledger.
 * Prefer device Active residual when it covers sessions: max(0, Active − Σ EAT).
 * Health Connect often under-reports Active (e.g. 14 kcal with 12k steps) — if
 * Active < sessions, fall back to the steps→kcal model instead of locking NEAT at 0.
 * Never add residual + steps (would double-count).
 * Steps model: gross steps→kcal minus session EAT so session burn is not re-counted
 * when day steps already include walk/run session steps (E1 / FULL-ENGINE-AUDIT-2026-08-01).
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

function fromSteps(
  steps: number,
  sessionEatKcal: number,
  weightKg: number | null | undefined,
  deviceActiveKcal: number | null,
  detailSuffix?: string,
): NeatEstimate {
  const gross = stepsToKcal(steps, weightKg)
  const neatKcal = Math.max(0, gross - sessionEatKcal)
  const base = `NEAT from steps (${steps.toLocaleString()} × ~${STEPS_KCAL_BASE} kcal @ ${STEPS_REF_KG} kg ref; −${sessionEatKcal} session EAT → ${neatKcal})`
  return {
    neatKcal,
    source: 'steps_model',
    steps,
    deviceActiveKcal,
    sessionEatKcal,
    detail: detailSuffix ? `${base} — ${detailSuffix}` : base,
  }
}

/**
 * Pick one NEAT path — residual when Active ≥ sessions; else steps when available.
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
    // Active covers / exceeds sessions → trust residual (may be 0 on heavy training days).
    if (deviceActive >= sessionEatKcal) {
      return {
        neatKcal: residual,
        source: 'device_active_residual',
        steps,
        deviceActiveKcal: deviceActive,
        sessionEatKcal,
        detail: `NEAT residual max(0, device Active ${deviceActive} − sessions ${sessionEatKcal})`,
      }
    }
    // Active < sessions: incomplete HC Active (common) — prefer steps over a locked 0.
    if (steps != null) {
      return fromSteps(
        steps,
        sessionEatKcal,
        input.weightKg,
        deviceActive,
        `Active ${deviceActive} < sessions ${sessionEatKcal}, residual unused`,
      )
    }
    return {
      neatKcal: 0,
      source: 'device_active_residual',
      steps: null,
      deviceActiveKcal: deviceActive,
      sessionEatKcal,
      detail: `NEAT residual max(0, device Active ${deviceActive} − sessions ${sessionEatKcal})`,
    }
  }

  if (steps != null) {
    return fromSteps(steps, sessionEatKcal, input.weightKg, null)
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
