/**
 * Soft food-logging coverage nudge for Fueling / Read.
 * Thin coverage is a data-quality signal — not a diet lecture.
 */

export const FOOD_COVERAGE_MIN_DAYS = 4

export type FoodCoverageNudge = {
  loggedDays: number
  windowDays: number
  thin: boolean
  /** Null when coverage is fine. */
  message: string | null
}

/** Soft CTA when logged food days in the window are below the solid-signal floor. */
export function foodCoverageNudge(
  loggedDays: number,
  windowDays = 7,
  minDays = FOOD_COVERAGE_MIN_DAYS,
): FoodCoverageNudge {
  const logged = Math.max(0, Math.floor(loggedDays))
  const window = Math.max(1, Math.floor(windowDays))
  const thin = logged < minDays
  return {
    loggedDays: logged,
    windowDays: window,
    thin,
    message: thin
      ? `Coverage thin — ${logged}/${window} food days logged. Log more days for solid energy / Verdict.`
      : null,
  }
}
