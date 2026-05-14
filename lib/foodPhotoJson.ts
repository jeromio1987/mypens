import { MEAL_ORDER, type MealType } from '@/lib/foodModels'

export type FoodAnalysisMode = 'meal_estimate' | 'nutrition_label'

export interface FoodAnalyzeItem {
  name: string
  meal: MealType
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
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

export function normalizeAnalysisMode(raw: unknown): FoodAnalysisMode {
  if (raw === 'nutrition_label') return 'nutrition_label'
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
    out.push({
      name,
      meal,
      kcal: Math.max(0, Number(r.kcal) || 0),
      proteinG: Math.max(0, Number(r.proteinG) || 0),
      carbsG: Math.max(0, Number(r.carbsG) || 0),
      fatG: Math.max(0, Number(r.fatG) || 0),
      fiberG: Math.max(0, Number(r.fiberG) || 0),
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
