export const RETENTION_COPY: Record<string, string> = {
  creatine_loading:    'Creatine is loading the tanks, so the scale is carrying extra water',
  creatine_maintenance:'Creatine is still building saturation, so today\'s weight gets a water adjustment',
  creatine_saturated:  'Creatine is saturated now, so this water load is mostly baked into baseline',
  alcohol_high:        'Alcohol is still causing retention, so the scale is not giving clean evidence',
  alcohol_moderate:    'Alcohol is adding temporary noise, so the reading gets a small correction',
  alcohol_fading:      'Alcohol effects are fading, but some water noise still hangs around',
  glycogen_high:       'High carbs refill glycogen, and glycogen brings water along for the ride',
  glycogen_moderate:   'Carbs are above baseline, so some extra glycogen water is counted',
  sodium_high:         'Salt is holding water, because sodium enjoys messing with the audit',
  sodium_restaurant:   'Restaurant food usually brings stealth sodium, so the scale gets discounted',
  hard_training:       'Hard training causes inflammation and water retention, not instant fat gain',
  flight_day:          'Travel can trap water, so this reading gets a caution flag',
  illness:             'Illness distorts fluid balance, so the scale is not clean evidence',
  not_morning:         'Later weigh-ins carry food, fluid, and daily chaos',
  confidence_high:     'Clean reading, low noise, useful evidence',
  confidence_medium:   'Some noise is present, but the signal still earns a hearing',
  confidence_low:      'Too many confounders today, so treat this as a rough estimate',
  tanita_unreliable:   'BIA reading looks shaky, so body composition gets a warning label',
  outlier_detected:    'This reading breaks the expected range, so the scale may be lying loudly',
  no_history:          'Not enough entries yet to build a reliable baseline',
}

export const VERDICT_LABELS: Record<string, string> = {
  verdict_weight:       'The Gravity Reckoning',
  verdict_food:         'The Nutrition Tax',
  verdict_sleep:        'The Sleep Debt',
  verdict_training:     'The Endurance Reserve',
  verdict_measurements: 'The Structural Report',
  verdict_journal:      'The Mood Ledger',
  verdict_anchor:       'The Recovery Ledger',
}

/** Look up retention / verdict copy by key; falls back to the key itself. */
export function explain(key: string): string {
  return RETENTION_COPY[key] ?? VERDICT_LABELS[key] ?? key
}
