import { MEAL_ORDER, type MealType } from '@/lib/foodModels'

export type FoodAnalysisMode = 'meal_estimate' | 'nutrition_label' | 'packaged_product'

export interface FoodAnalyzeItem {
  name: string
  meal: MealType
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  brand: string | null
  packGrams: number | null
  /** Grams the macros describe. */
  assumedGrams: number | null
  /** AI default portion to log (often = pack or serving). */
  portionGrams: number | null
}

export function parseJsonFromAssistant(text: string): unknown {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(t)
  const inner = fence ? fence[1].trim() : t
  const start = inner.indexOf('{')
  const end = inner.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object in model output')
  return JSON.parse(inner.slice(start, end + 1)) as unknown
}

function isMeal(s: unknown): s is MealType {
  return typeof s === 'string' && (MEAL_ORDER as readonly string[]).includes(s)
}

function optPositive(n: unknown): number | null {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.round(v * 10) / 10
}

function optBrand(n: unknown): string | null {
  if (typeof n !== 'string') return null
  const t = n.trim()
  return t.length ? t.slice(0, 80) : null
}

export function normalizeAnalysisMode(raw: unknown): FoodAnalysisMode {
  if (raw === 'nutrition_label') return 'nutrition_label'
  if (raw === 'packaged_product') return 'packaged_product'
  return 'meal_estimate'
}

export function normalizeItems(raw: unknown, defaultMeal: MealType): FoodAnalyzeItem[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as { items?: unknown }
  if (!Array.isArray(obj.items)) return []
  const out: FoodAnalyzeItem[] = []
  for (const row of obj.items) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    if (!name) continue
    const meal = isMeal(r.meal) ? r.meal : defaultMeal
    const packGrams = optPositive(r.packGrams)
    let assumedGrams = optPositive(r.assumedGrams)
    let portionGrams = optPositive(r.portionGrams)
    if (!assumedGrams && portionGrams) assumedGrams = portionGrams
    if (!assumedGrams && packGrams) assumedGrams = packGrams
    if (!portionGrams && assumedGrams) portionGrams = assumedGrams
    out.push({
      name,
      meal,
      kcal: Math.max(0, Number(r.kcal) || 0),
      proteinG: Math.max(0, Number(r.proteinG) || 0),
      carbsG: Math.max(0, Number(r.carbsG) || 0),
      fatG: Math.max(0, Number(r.fatG) || 0),
      fiberG: Math.max(0, Number(r.fiberG) || 0),
      brand: optBrand(r.brand),
      packGrams,
      assumedGrams,
      portionGrams,
    })
    if (out.length >= 12) break
  }
  return out
}

export function extractVisionPayload(parsed: unknown, defaultMeal: MealType): {
  analysisMode: FoodAnalysisMode
  dishSummary: string
  items: FoodAnalyzeItem[]
} {
  const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  const dishSummary = typeof root.dishSummary === 'string' ? root.dishSummary.trim() : ''
  const analysisMode = normalizeAnalysisMode(root.analysisMode)
  const items = normalizeItems(parsed, defaultMeal)
  return { analysisMode, dishSummary, items }
}
