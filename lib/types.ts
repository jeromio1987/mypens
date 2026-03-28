/**
 * lib/types.ts — shared domain types for MY PENS
 *
 * ConfidenceLevel uses TitleCase here (the canonical public-facing form).
 * The internal retention model (lib/retentionModels.ts) uses lowercase
 * 'high' | 'medium' | 'low' — use toConfidenceLevel() / fromConfidenceLevel()
 * to convert at the boundary if needed.
 */

// ─── Confidence ───────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'High' | 'Medium' | 'Low'

/** Convert from internal lowercase to public TitleCase */
export function toConfidenceLevel(raw: 'high' | 'medium' | 'low'): ConfidenceLevel {
  return (raw.charAt(0).toUpperCase() + raw.slice(1)) as ConfidenceLevel
}

/** Convert from public TitleCase back to internal lowercase */
export function fromConfidenceLevel(level: ConfidenceLevel): 'high' | 'medium' | 'low' {
  return level.toLowerCase() as 'high' | 'medium' | 'low'
}

// ─── Daily Entry ──────────────────────────────────────────────────────────────

/**
 * DailyEntry — unified snapshot of everything logged for a single date.
 *
 * Field → Prisma model mapping:
 *   weightKg          → WeightEntry.scaleKg
 *   sleptHours        → SleepEntry.hours
 *   trained           → TrainingEntry rows exist for this date
 *   steps             → (future field)
 *   tripMode          → EventTag type = 'travel' active on this date
 *   flightDay         → WeightEntry.flightDay
 *   carbsHeavy        → WeightEntry.carbsG > threshold
 *   creatineLoading   → WeightEntry.creatineDaysOn <= 7 && creatineDoseG >= 10
 *
 *   restaurantHeavy   → WeightEntry.restaurantMeal  (v1.1 rename, same semantic)
 *   alcoholUnits      → WeightEntry.alcoholUnits
 *   lateMeal          → (new v1.1 field — not yet in schema)
 *   proteinAnchored   → (new v1.1 field — not yet in schema)
 *   dessertTreat      → (new v1.1 field — not yet in schema)
 */
export interface DailyEntry {
  date: string // ISO yyyy-mm-dd

  weightKg?: number

  // ── existing fields ─────────────────────────────────────────────────────────
  sleptHours?: number
  trained?: boolean
  steps?: number
  tripMode?: boolean
  flightDay?: boolean
  carbsHeavy?: boolean
  creatineLoading?: boolean

  // ── v1.1 restaurant mode fields ─────────────────────────────────────────────

  /** True if the day included a restaurant or heavily prepared meal
   *  (maps to WeightEntry.restaurantMeal in the current schema) */
  restaurantHeavy?: boolean

  /** Number of standard alcohol units consumed (0–6) */
  alcoholUnits?: number

  /** True if the last meal of the day was after 20:00 */
  lateMeal?: boolean

  /** True if every main meal of the day was built around a protein source first */
  proteinAnchored?: boolean

  /** True if a deliberate dessert or treat was included that day */
  dessertTreat?: boolean
}
