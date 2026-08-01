import { describe, expect, it } from 'vitest'
import {
  buildEnrichmentQuery,
  completenessScore,
  enrichmentWritePayload,
  extractPortionGrams,
  proposeEnrichment,
  scoreConfidence,
  scoreMacroFit,
  scoreNameFit,
  type EnrichableEntry,
} from '../lib/foodEnrichment'
import type { FoodProductHit } from '../lib/openFoodFacts'

const yoghurtHit: FoodProductHit = {
  id: 'off:5400111111111',
  source: 'openfoodfacts',
  name: 'Delhaize 0% Greek Style yoghurt',
  brand: 'Delhaize',
  packGrams: 1000,
  assumedGrams: 100,
  kcal: 55,
  proteinG: 10,
  carbsG: 4,
  fatG: 0,
  fiberG: 0,
  micros: { sodiumMg: 40, calciumMg: 120, calciumB12Mcg: 0.4 },
  barcode: '5400111111111',
}

describe('extractPortionGrams / buildEnrichmentQuery', () => {
  it('reads grams from name', () => {
    expect(extractPortionGrams('Skyr nature 150g')).toBe(150)
    expect(extractPortionGrams('Yoghurt (200 g)')).toBe(200)
  })

  it('strips portion markers from query', () => {
    const q = buildEnrichmentQuery('Delhaize skyr 150g', null)
    expect(q).not.toMatch(/150/)
    expect(q).toMatch(/delhaize/)
    expect(q).toMatch(/skyr/)
  })
})

describe('scoring', () => {
  it('scores strong name overlap highly', () => {
    expect(scoreNameFit('Delhaize skyr', 'Delhaize 0% Greek Style yoghurt', 'Delhaize')).toBeGreaterThan(0.2)
    expect(scoreNameFit('Delhaize Greek yoghurt', yoghurtHit.name, 'Delhaize')).toBeGreaterThan(0.45)
  })

  it('fits macros via kcal-implied grams', () => {
    const { macroFit, estimatedGrams } = scoreMacroFit(
      {
        name: 'Delhaize yoghurt 150g',
        notes: null,
        kcal: 83,
        proteinG: 15,
        carbsG: 6,
        fatG: 0,
        fiberG: 0,
      },
      yoghurtHit,
    )
    expect(estimatedGrams).toBeGreaterThan(100)
    expect(estimatedGrams).toBeLessThan(200)
    expect(macroFit).toBeGreaterThan(0.7)
  })

  it('computes completeness from known keys', () => {
    expect(completenessScore({ sodiumMg: 1, calciumMg: 2, vitaminB12Mcg: 0.1 })).toBeCloseTo(3 / 9, 2)
    expect(scoreConfidence(0.8, 0.9, 3)).toBeGreaterThan(0.7)
  })
})

describe('proposeEnrichment', () => {
  const entry: EnrichableEntry = {
    id: 'entry1',
    name: 'Delhaize Greek yoghurt 150g',
    notes: null,
    kcal: 83,
    proteinG: 15,
    carbsG: 6,
    fatG: 0,
    fiberG: 0,
    microsJson: null,
    tagsJson: null,
  }

  it('skips when micros already present unless force', async () => {
    const skipped = await proposeEnrichment(
      { ...entry, microsJson: JSON.stringify({ sodiumMg: 10 }) },
      { searchFn: async () => [yoghurtHit] },
    )
    expect(skipped.status).toBe('already_enriched')

    const forced = await proposeEnrichment(
      { ...entry, microsJson: JSON.stringify({ sodiumMg: 10 }) },
      { force: true, searchFn: async () => [yoghurtHit] },
    )
    expect(forced.status).toBe('matched')
    expect(forced.micros.sodiumMg).toBeGreaterThan(0)
  })

  it('returns matched proposal with scaled micros and write payload', async () => {
    const proposal = await proposeEnrichment(entry, {
      minConfidence: 0.5,
      searchFn: async () => [yoghurtHit],
    })
    expect(proposal.status).toBe('matched')
    expect(proposal.meta?.macrosPreserved).toBe(true)
    expect(proposal.meta?.source).toBe('openfoodfacts')
    expect(Object.keys(proposal.micros).length).toBeGreaterThan(0)
    // ~150g / 100g → sodium ~60
    expect(proposal.micros.sodiumMg).toBeGreaterThan(50)
    expect(proposal.micros.sodiumMg).toBeLessThan(80)

    const payload = enrichmentWritePayload(proposal)
    expect(payload?.microsJson).toBeTruthy()
    expect(payload?.enrichmentJson).toContain('openfoodfacts')
  })

  it('returns no_match when search empty', async () => {
    const proposal = await proposeEnrichment(entry, { searchFn: async () => [] })
    expect(proposal.status).toBe('no_match')
    expect(enrichmentWritePayload(proposal)).toBeNull()
  })
})
