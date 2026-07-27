/**
 * Date window helpers — re-exports the canonical timeWindow module (P9).
 * Prefer importing from `@/lib/timeWindow` in new code.
 */
export {
  toDateStr,
  fromDateStr,
  shiftDateStr,
  today,
  mondayOf,
  weekBounds,
  calendarWeek,
  rollingWindow,
  windowWhere,
} from './timeWindow'
