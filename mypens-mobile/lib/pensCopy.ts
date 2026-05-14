import type { ConfidenceLevel } from '@/lib/retentionModels'

/** Same wording as web `WeightTrend` / dashboard copy — keep in sync manually. */
export function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'High confidence'
    case 'medium':
      return 'Medium confidence'
    case 'low':
      return 'Low confidence'
  }
}

export function confidenceDetail(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'All known confounders accounted for — true weight is a reliable guide today.'
    case 'medium':
      return 'One or two confounders — use the band; avoid big calorie swings from a single reading.'
    case 'low':
      return 'Several confounders — treat the number as directional, not precise.'
  }
}

export function bandCaption(
  bandKg: number,
  source: 'dynamic' | 'static',
): string {
  const src = source === 'dynamic' ? 'from your recent volatility' : 'rule-based fallback'
  return `Uncertainty band ±${bandKg} kg (${src}).`
}
