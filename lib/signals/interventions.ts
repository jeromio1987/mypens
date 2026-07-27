import type { SignalId } from './signalConfig'

export type InterventionPlan = {
  signalId: SignalId
  action: string
  expectedDirection: string
  horizonDays: number
}

const MAP: Record<SignalId, Omit<InterventionPlan, 'signalId'>> = {
  weight_stall_vs_deficit: {
    action: 'Audit food coverage and sodium/creatine confounders before cutting harder.',
    expectedDirection: 'True weight should drift down or logging gaps close',
    horizonDays: 14,
  },
  sleep_below_norm: {
    action: 'Protect a 7h+ sleep floor for 5 nights; cut late intensity.',
    expectedDirection: 'Sleep hours ≥6.5 on most nights',
    horizonDays: 7,
  },
  rhr_elevated: {
    action: 'Insert an easy day and check alcohol / illness / load spike.',
    expectedDirection: 'RHR back toward baseline',
    horizonDays: 7,
  },
  load_spike: {
    action: 'Hold volume flat one week; keep one long easy session only.',
    expectedDirection: 'Load ratio vs prior week ≤1.2',
    horizonDays: 7,
  },
  load_drop: {
    action: 'Rebuild mid-week session if health allows; else document deload intent.',
    expectedDirection: 'Load recovers toward prior baseline',
    horizonDays: 10,
  },
  protein_below_target: {
    action: 'Hit protein target on every logged day (anchor breakfast).',
    expectedDirection: '≥4 days at target protein',
    horizonDays: 7,
  },
  food_coverage_drop: {
    action: 'Log at least one meal on empty days; mark incomplete when partial.',
    expectedDirection: '≥4 food-logged days / 7',
    horizonDays: 7,
  },
  iron_low_vs_load: {
    action:
      'Treat ferritin + load as soft confounders only — ease hard volume one week and review labs with your clinician; not medical advice.',
    expectedDirection: 'Load ratio cools; lab context re-checked with clinician',
    horizonDays: 14,
  },
  thyroid_out_of_ref: {
    action:
      'TSH flag is educational context only — do not change BMR or cut calories from labs; discuss with your clinician.',
    expectedDirection: 'Clinician follow-up; app keeps Mifflin/Katch estimates unchanged',
    horizonDays: 14,
  },
}

export function interventionFor(signalId: SignalId): InterventionPlan {
  return { signalId, ...MAP[signalId] }
}

export function interventionsFor(ids: SignalId[]): InterventionPlan[] {
  return ids.map(interventionFor)
}
