/**
 * WP 4.1 — Signal thresholds in one place (not scattered).
 * Tune here only; detectSignals reads this config.
 */

export type SignalId =
  | 'weight_stall_vs_deficit'
  | 'sleep_below_norm'
  | 'rhr_elevated'
  | 'load_spike'
  | 'load_drop'
  | 'protein_below_target'
  | 'food_coverage_drop'
  | 'iron_low_vs_load'
  | 'thyroid_out_of_ref'

export type SignalConfig = {
  id: SignalId
  label: string
  windowDays: number
  /** Human-readable threshold description */
  rule: string
  params: Record<string, number>
}

export const SIGNAL_CONFIG: readonly SignalConfig[] = [
  {
    id: 'weight_stall_vs_deficit',
    label: 'Weight flat while energy deficit',
    windowDays: 10,
    rule: 'Scale change < 0.3 kg while mean energyDelta ≤ −300',
    params: { minDeficitKcal: -300, maxAbsKgChange: 0.3 },
  },
  {
    id: 'sleep_below_norm',
    label: 'Sleep under floor',
    windowDays: 5,
    rule: '≥3 nights with sleepHours < 6.5',
    params: { minHours: 6.5, minNights: 3 },
  },
  {
    id: 'rhr_elevated',
    label: 'Resting HR elevated',
    windowDays: 7,
    rule: 'Mean RHR ≥ baseline + 5 (baseline = earlier window mean)',
    params: { deltaBpm: 5 },
  },
  {
    id: 'load_spike',
    label: 'Training load spike',
    windowDays: 7,
    rule: 'Last 7d load ≥ 1.6× prior 7d',
    params: { ratio: 1.6 },
  },
  {
    id: 'load_drop',
    label: 'Training load drop',
    windowDays: 7,
    rule: 'Last 7d load ≤ 0.5× prior 7d (and prior > 0)',
    params: { ratio: 0.5 },
  },
  {
    id: 'protein_below_target',
    label: 'Protein under target',
    windowDays: 7,
    rule: '≥4 logged days with proteinG < target',
    params: { targetG: 150, minDays: 4 },
  },
  {
    id: 'food_coverage_drop',
    label: 'Food log coverage weak',
    windowDays: 7,
    rule: 'Fewer than 4 food-logged days in window',
    params: { minLoggedDays: 4 },
  },
  {
    id: 'iron_low_vs_load',
    label: 'Ferritin below ref with elevated load',
    windowDays: 7,
    rule: 'Latest ferritin below listed ref AND last 7d load ≥ 1.3× prior 7d',
    params: { loadRatio: 1.3 },
  },
  {
    id: 'thyroid_out_of_ref',
    label: 'TSH outside listed ref',
    windowDays: 14,
    rule: 'Latest TSH below or above listed lab ref (soft context only)',
    params: {},
  },
] as const

export function signalConfig(id: SignalId): SignalConfig {
  const row = SIGNAL_CONFIG.find(s => s.id === id)
  if (!row) throw new Error(`Unknown signal ${id}`)
  return row
}
