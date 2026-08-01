/**
 * Nutritional review / enrichment engine.
 * Reverse-matches logged FoodEntry rows against Open Food Facts, scales micros
 * to the logged portion, and never overwrites user macros by default.
 */

import {
  inferFoodTags,
  parseMicrosJson,
  parseTagsJson,
  scaleMicros,
  serializeMicros,
  serializeTags,
  type FoodMicros,
} from '@/lib/foodMicros'
import { foodNameKey } from '@/lib/foodNameKey'
import {
  parseQuantityToGrams,
  searchOpenFoodFacts,
  type FoodProductHit,
} from '@/lib/openFoodFacts'

const KNOWN_MICRO_KEYS = [
  'sodiumMg',
  'potassiumMg',
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'vitaminCMg',
  'vitaminDMcg',
  'vitaminB12Mcg',
  'zincMg',
] as const

export type EnrichmentStatus = 'matched' | 'weak_match' | 'no_match' | 'skipped' | 'already_enriched'

export type FoodEnrichmentMeta = {
  source: 'openfoodfacts'
  productId: string
  barcode: string | null
  matchedName: string
  brand: string | null
  confidence: number
  nameFit: number
  macroFit: number
  estimatedGrams: number | null
  completeness: number
  microKeys: string[]
  enrichedAt: string
  status: EnrichmentStatus
  macrosPreserved: true
  dryRun?: boolean
  reason?: string
}

export type EnrichableEntry = {
  id: string
  name: string
  notes?: string | null
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  microsJson?: string | null
  tagsJson?: string | null
  enrichmentJson?: string | null
}

export type EnrichmentProposal = {
  entryId: string
  query: string
  status: EnrichmentStatus
  confidence: number
  completeness: number
  micros: FoodMicros
  tags: string[]
  meta: FoodEnrichmentMeta | null
  candidates: Array<{
    id: string
    name: string
    brand: string | null
    barcode: string | null
    confidence: number
    nameFit: number
    macroFit: number
    estimatedGrams: number | null
    microKeyCount: number
  }>
  reason?: string
}

export type EnrichOptions = {
  /** Minimum confidence to treat as a usable match (default 0.55). */
  minConfidence?: number
  /** Re-match even when microsJson already has keys (default false). */
  force?: boolean
  /** AbortSignal for OFF fetch. */
  signal?: AbortSignal
  /** Injected search (tests). */
  searchFn?: (query: string, opts?: { pageSize?: number; signal?: AbortSignal }) => Promise<FoodProductHit[]>
}

/** Pull portion grams from name/notes when present ("Skyr 150g", "450 g"). */
export function extractPortionGrams(...texts: Array<string | null | undefined>): number | null {
  for (const raw of texts) {
    if (!raw) continue
    const m = raw.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gram|grams|kg|ml|l)\b/)
    if (!m) continue
    const grams = parseQuantityToGrams(`${m[1].replace(',', '.')} ${m[2]}`)
    if (grams != null && grams > 0 && grams < 5000) return grams
  }
  return null
}

/** Build an OFF search query from logged name + notes (strip portions, keep brand words). */
export function buildEnrichmentQuery(name: string, notes?: string | null): string {
  const fromNotes = (notes ?? '')
    .replace(/\b(OFF|AI|pack|label)\b[:\s-]*/gi, ' ')
    .trim()
  const combined = [name, fromNotes].filter(Boolean).join(' ')
  const key = foodNameKey(combined) || foodNameKey(name) || name
  return key.replace(/\s+/g, ' ').trim().slice(0, 80)
}

function tokenize(s: string): Set<string> {
  return new Set(
    foodNameKey(s)
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length >= 2),
  )
}

/** Jaccard-ish name overlap in [0, 1], with bonus for substring containment. */
export function scoreNameFit(entryName: string, hitName: string, brand?: string | null): number {
  const a = tokenize(entryName)
  const b = tokenize(hitName)
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  let jaccard = union > 0 ? inter / union : 0

  const ak = foodNameKey(entryName)
  const bk = foodNameKey(hitName)
  if (ak && bk && (ak.includes(bk) || bk.includes(ak))) {
    jaccard = Math.max(jaccard, 0.72)
  }
  if (brand) {
    const brandKey = foodNameKey(brand)
    if (brandKey && ak.includes(brandKey)) jaccard = Math.min(1, jaccard + 0.08)
  }
  return Math.round(Math.min(1, jaccard) * 1000) / 1000
}

function relErr(logged: number, predicted: number): number {
  const denom = Math.max(Math.abs(logged), Math.abs(predicted), 1)
  return Math.abs(logged - predicted) / denom
}

/**
 * Estimate eaten grams from kcal ratio (OFF is per 100g), then score macro agreement.
 * Returns macroFit in [0,1] and estimatedGrams.
 */
export function scoreMacroFit(
  entry: Pick<EnrichableEntry, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'name' | 'notes'>,
  hit: Pick<FoodProductHit, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'>,
): { macroFit: number; estimatedGrams: number | null } {
  const namedGrams = extractPortionGrams(entry.name, entry.notes)
  let estimatedGrams: number | null = null

  if (hit.kcal > 0 && entry.kcal > 0) {
    estimatedGrams = Math.round((entry.kcal / hit.kcal) * 100)
  }
  if (namedGrams != null) {
    // Prefer explicit portion when kcal-implied grams are wildly off or missing.
    if (estimatedGrams == null || Math.abs(estimatedGrams - namedGrams) / namedGrams > 0.45) {
      estimatedGrams = namedGrams
    } else {
      // Blend toward named portion.
      estimatedGrams = Math.round(estimatedGrams * 0.6 + namedGrams * 0.4)
    }
  }
  if (estimatedGrams != null) {
    estimatedGrams = Math.max(5, Math.min(2000, estimatedGrams))
  }

  const scale = estimatedGrams != null ? estimatedGrams / 100 : 1
  const pred = {
    kcal: hit.kcal * scale,
    proteinG: hit.proteinG * scale,
    carbsG: hit.carbsG * scale,
    fatG: hit.fatG * scale,
    fiberG: hit.fiberG * scale,
  }

  // Weighted: kcal + protein matter most for diary reconciliation.
  const errs = [
    relErr(entry.kcal, pred.kcal) * 1.4,
    relErr(entry.proteinG, pred.proteinG) * 1.2,
    relErr(entry.carbsG, pred.carbsG),
    relErr(entry.fatG, pred.fatG),
    relErr(entry.fiberG, pred.fiberG) * 0.6,
  ]
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length
  const macroFit = Math.round(Math.max(0, Math.min(1, 1 - mean)) * 1000) / 1000
  return { macroFit, estimatedGrams }
}

export function scoreConfidence(nameFit: number, macroFit: number, microKeyCount: number): number {
  const microBoost = Math.min(0.08, microKeyCount * 0.015)
  const raw = nameFit * 0.45 + macroFit * 0.5 + microBoost
  return Math.round(Math.min(1, raw) * 1000) / 1000
}

/**
 * Fraction of known micro keys present (coverage only).
 * Does not reflect gram-scaling uncertainty — see completenessWithUncertainty.
 */
export function completenessScore(micros: FoodMicros): number {
  let n = 0
  for (const k of KNOWN_MICRO_KEYS) {
    if (micros[k] != null && micros[k]! > 0) n++
  }
  return Math.round((n / KNOWN_MICRO_KEYS.length) * 1000) / 1000
}

/** Coverage + honest note when micros were scaled from a kcal-derived gram guess (F1). */
export function completenessWithUncertainty(
  micros: FoodMicros,
  estimatedGrams: number | null | undefined,
): { completeness: number; scalingUncertain: boolean; note: string | null } {
  const completeness = completenessScore(micros)
  const scalingUncertain = estimatedGrams != null && estimatedGrams > 0
  return {
    completeness,
    scalingUncertain,
    note: scalingUncertain
      ? `Micro amounts scaled from ~${estimatedGrams} g estimate — coverage ${completeness} does not imply accuracy`
      : null,
  }
}

export function parseEnrichmentJson(raw: string | null | undefined): FoodEnrichmentMeta | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as FoodEnrichmentMeta
    if (!o || typeof o !== 'object' || o.source !== 'openfoodfacts') return null
    return o
  } catch {
    return null
  }
}

export function serializeEnrichment(meta: FoodEnrichmentMeta | null | undefined): string | null {
  if (!meta) return null
  return JSON.stringify(meta)
}

function candidateSummary(
  hit: FoodProductHit,
  nameFit: number,
  macroFit: number,
  confidence: number,
  estimatedGrams: number | null,
) {
  return {
    id: hit.id,
    name: hit.name,
    brand: hit.brand,
    barcode: hit.barcode ?? null,
    confidence,
    nameFit,
    macroFit,
    estimatedGrams,
    microKeyCount: hit.micros ? Object.keys(hit.micros).length : 0,
  }
}

/**
 * Propose enrichment for one logged entry (does not write to DB).
 */
export async function proposeEnrichment(
  entry: EnrichableEntry,
  opts: EnrichOptions = {},
): Promise<EnrichmentProposal> {
  const minConfidence = opts.minConfidence ?? 0.55
  const force = opts.force ?? false
  const existingMicros = parseMicrosJson(entry.microsJson)
  const existingKeys = Object.keys(existingMicros)

  if (!force && existingKeys.length > 0) {
    return {
      entryId: entry.id,
      query: buildEnrichmentQuery(entry.name, entry.notes),
      status: 'already_enriched',
      confidence: 0,
      completeness: completenessScore(existingMicros),
      micros: existingMicros,
      tags: parseTagsJson(entry.tagsJson),
      meta: parseEnrichmentJson(entry.enrichmentJson),
      candidates: [],
      reason: 'microsJson already present — pass force=true to re-match',
    }
  }

  const query = buildEnrichmentQuery(entry.name, entry.notes)
  if (query.length < 2) {
    return {
      entryId: entry.id,
      query,
      status: 'no_match',
      confidence: 0,
      completeness: 0,
      micros: {},
      tags: parseTagsJson(entry.tagsJson),
      meta: null,
      candidates: [],
      reason: 'query too short',
    }
  }

  const search = opts.searchFn ?? searchOpenFoodFacts
  const hits = await search(query, { pageSize: 10, signal: opts.signal })

  const scored = hits
    .map(hit => {
      const nameFit = scoreNameFit(entry.name, hit.name, hit.brand)
      const { macroFit, estimatedGrams } = scoreMacroFit(entry, hit)
      const microKeyCount = hit.micros ? Object.keys(hit.micros).length : 0
      const confidence = scoreConfidence(nameFit, macroFit, microKeyCount)
      return { hit, nameFit, macroFit, estimatedGrams, confidence, microKeyCount }
    })
    .sort((a, b) => b.confidence - a.confidence)

  const candidates = scored.slice(0, 5).map(s =>
    candidateSummary(s.hit, s.nameFit, s.macroFit, s.confidence, s.estimatedGrams),
  )

  const best = scored[0]
  if (!best || best.confidence < 0.35) {
    return {
      entryId: entry.id,
      query,
      status: 'no_match',
      confidence: best?.confidence ?? 0,
      completeness: 0,
      micros: {},
      tags: parseTagsJson(entry.tagsJson),
      meta: null,
      candidates,
      reason: best ? 'best candidate below floor (0.35)' : 'no OFF hits',
    }
  }

  const scale = best.estimatedGrams != null ? best.estimatedGrams / 100 : 1
  const rawMicros = best.hit.micros ?? {}
  const micros = scaleMicros(rawMicros, scale)
  const completeness = completenessScore(micros)

  const inferred = inferFoodTags({
    kcal: entry.kcal,
    proteinG: entry.proteinG,
    fiberG: entry.fiberG,
    name: entry.name,
    visionTags: parseTagsJson(entry.tagsJson),
  })
  const tags = [...new Set([...inferred, ...(best.microKeyCount > 0 ? ['off_enriched'] : [])])].slice(0, 12)

  const status: EnrichmentStatus = best.confidence >= minConfidence ? 'matched' : 'weak_match'
  const meta: FoodEnrichmentMeta = {
    source: 'openfoodfacts',
    productId: best.hit.id,
    barcode: best.hit.barcode ?? null,
    matchedName: best.hit.name,
    brand: best.hit.brand,
    confidence: best.confidence,
    nameFit: best.nameFit,
    macroFit: best.macroFit,
    estimatedGrams: best.estimatedGrams,
    completeness,
    microKeys: Object.keys(micros),
    enrichedAt: new Date().toISOString(),
    status,
    macrosPreserved: true,
  }

  return {
    entryId: entry.id,
    query,
    status,
    confidence: best.confidence,
    completeness,
    micros,
    tags,
    meta,
    candidates,
    reason:
      status === 'weak_match'
        ? `confidence ${best.confidence} below minConfidence ${minConfidence}`
        : Object.keys(micros).length === 0
          ? 'match ok but OFF product has no micros'
          : undefined,
  }
}

/** Persist fields for an applied enrichment (macros untouched). */
export function enrichmentWritePayload(proposal: EnrichmentProposal, applyWeak = false) {
  const ok =
    proposal.status === 'matched' ||
    (applyWeak && proposal.status === 'weak_match' && proposal.meta != null)
  if (!ok || !proposal.meta) return null
  if (Object.keys(proposal.micros).length === 0) return null

  return {
    microsJson: serializeMicros(proposal.micros),
    tagsJson: serializeTags(proposal.tags),
    enrichmentJson: serializeEnrichment({ ...proposal.meta, dryRun: false }),
  }
}
