/**
 * WP 3.5 — single auditor voice stem.
 * Prefer importing copy from here; keep VERDICT_LABELS as the lexicon source.
 */

export { VERDICT_LABELS, explain } from '@/lib/explanationCopy'

export function auditorInsufficient(pillar: string, reason: string): string {
  return `${pillar}: no score — ${reason}`
}

export function auditorToneRule(): string {
  return 'The tone may be stern; the number underneath must be true.'
}
