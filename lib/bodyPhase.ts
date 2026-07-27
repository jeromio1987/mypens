import { DEFAULT_TARGETS, type DailyTargets } from '@/lib/foodModels'

export type BodyPhase = 'cut' | 'bulk' | 'recomp' | 'maintain'

export type BodyPhaseState = {
  phase: BodyPhase
  startedAt: string
  kgPerWeek: number
  expectedEndAt: string | null
}

export type PhasePlanBias = {
  preferStrength: boolean
  preferEasyAerobic: boolean
  volumeScale: number
  note: string
}

const PHASES: BodyPhase[] = ['cut', 'bulk', 'recomp', 'maintain']

export function isBodyPhase(v: unknown): v is BodyPhase {
  return typeof v === 'string' && (PHASES as string[]).includes(v)
}

/** kcal/day from kg/week at ~7700 kcal/kg. */
export function kgWeekToKcalDay(kgPerWeek: number): number {
  return Math.round((kgPerWeek * 7700) / 7)
}

export function deriveTargets(
  phase: BodyPhase,
  weightKg: number | null,
  maintenanceKcal: number | null,
  kgPerWeek = 0.4,
): DailyTargets {
  const maint = maintenanceKcal && maintenanceKcal > 1200 ? maintenanceKcal : DEFAULT_TARGETS.kcal
  const w = weightKg && weightKg > 40 ? weightKg : null
  const deficit = Math.max(250, Math.min(750, kgWeekToKcalDay(Math.abs(kgPerWeek) || 0.4)))

  switch (phase) {
    case 'cut':
      return {
        kcal: Math.round(maint - deficit),
        proteinG: Math.round(w ? w * 2.0 : DEFAULT_TARGETS.proteinG + 20),
        carbsG: Math.round(DEFAULT_TARGETS.carbsG * 0.85),
        fatG: DEFAULT_TARGETS.fatG,
      }
    case 'bulk':
      return {
        kcal: Math.round(maint + Math.min(400, deficit * 0.7)),
        proteinG: Math.round(w ? w * 1.8 : DEFAULT_TARGETS.proteinG),
        carbsG: Math.round(DEFAULT_TARGETS.carbsG * 1.15),
        fatG: DEFAULT_TARGETS.fatG,
      }
    case 'recomp':
      return {
        kcal: Math.round(maint),
        proteinG: Math.round(w ? w * 2.0 : DEFAULT_TARGETS.proteinG + 10),
        carbsG: DEFAULT_TARGETS.carbsG,
        fatG: DEFAULT_TARGETS.fatG,
      }
    default:
      return { ...DEFAULT_TARGETS, kcal: Math.round(maint) }
  }
}

export function phasePlanBias(phase: BodyPhase): PhasePlanBias {
  switch (phase) {
    case 'cut':
      return {
        preferStrength: true,
        preferEasyAerobic: true,
        volumeScale: 0.85,
        note: 'Cut bias — protect strength, favour easy aerobic, soft quality volume.',
      }
    case 'bulk':
      return {
        preferStrength: true,
        preferEasyAerobic: false,
        volumeScale: 1.1,
        note: 'Bulk bias — progressive overload, keep quality sessions.',
      }
    case 'recomp':
      return {
        preferStrength: true,
        preferEasyAerobic: true,
        volumeScale: 1.0,
        note: 'Recomp bias — strength + easy aerobic balance.',
      }
    default:
      return {
        preferStrength: false,
        preferEasyAerobic: false,
        volumeScale: 1.0,
        note: 'Maintain — standard planner mix.',
      }
  }
}

export function defaultPhaseState(today: string): BodyPhaseState {
  return {
    phase: 'maintain',
    startedAt: today,
    kgPerWeek: 0.4,
    expectedEndAt: null,
  }
}
