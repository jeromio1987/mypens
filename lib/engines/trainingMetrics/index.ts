/**
 * Training metrics engine — Strava-subscription-style models on MY PENS data.
 *
 * Built on daily PLU (`scripts/lib/trainingLoad.mjs`) plus pure stream helpers.
 * No UI required — cockpit enriches series with Fitness/Freshness when available.
 *
 * Out of scope (not planned): Strava segments, matched runs, segment PRs —
 * needs segment catalog + GPS streams we do not store.
 */

export type {
  DailyLoadPoint,
  EfficiencyPoint,
  FitnessDay,
  FosterWeek,
  GapResult,
  GapSample,
  PeakPoint,
  RelativeEffortResult,
} from './types'

export {
  ACWR_ACUTE_TAU,
  ACWR_CHRONIC_TAU,
  ATL_TAU,
  CTL_TAU,
  FITNESS_FRESHNESS_META,
  addDaysIso,
  buildFitnessSeries,
  ewmaAlpha,
  fillDailyLoads,
} from './fitnessFreshness'
export type { FitnessSeriesOpts } from './fitnessFreshness'

export {
  LOAD_RATIOS_META,
  fosterMonotonyStrain,
  fosterWeekEnding,
  rollingFosterWeeks,
} from './loadRatios'

export {
  GAP_META,
  gradeAdjustedPace,
  gradeAdjustedPaceFromTotals,
  gradeAdjustedPaceStream,
  minettiRunningCost,
} from './gap'

export {
  DEFAULT_PEAK_DURATIONS_SEC,
  PEAK_CURVES_META,
  peakRollingAverages,
  peakRollingAveragesTimed,
} from './peakCurves'

export {
  RELATIVE_EFFORT_META,
  edwardsFromAvgHr,
  edwardsFromHrStream,
  edwardsRelativeEffort,
  edwardsZoneIndex,
} from './relativeEffort'

export {
  EFFICIENCY_META,
  medianEfficiency,
  sessionEfficiency,
} from './efficiency'
export type { SessionEfficiencyInput } from './efficiency'
