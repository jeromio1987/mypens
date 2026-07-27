import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { searchOpenFoodFacts, type FoodProductHit } from '@/lib/openFoodFacts'
import { foodNameKey } from '@/lib/foodNameKey'
import { consume } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/food/products?q=delhaize+yoghurt
 * Merges personal FoodEntry history with Open Food Facts (worldwide).
 * History is deduped by product key (grams stripped) — one row per food; user sets grams.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || searchParams.get('search') || '').trim()
    if (q.length < 2) {
      return NextResponse.json({ query: q, products: [] as FoodProductHit[] })
    }

    const rl = consume('food-products', { capacity: 60, refillPerSec: 60 / 60 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }

    const historyPromise = prisma.foodEntry
      .findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      })
      .catch(() => [])

    const offPromise = searchOpenFoodFacts(q, { pageSize: 10 }).catch(err => {
      console.warn('[food/products] OFF search failed', err instanceof Error ? err.message : err)
      return [] as FoodProductHit[]
    })

    const [historyRows, offHits] = await Promise.all([historyPromise, offPromise])

    const historyHits: FoodProductHit[] = []
    const seenKeys = new Set<string>()
    for (const e of historyRows) {
      const key = foodNameKey(e.name)
      if (!key || seenKeys.has(key)) continue
      seenKeys.add(key)
      // Prefer a clean label without embedded gram suffixes when possible.
      const cleanName =
        e.name
          .replace(/\s*[(\[{]?\s*\d+([.,]\d+)?\s*(g|gr|gram|grams)\s*[)\]}]?\s*$/i, '')
          .trim() || e.name
      historyHits.push({
        id: `history:${e.id}`,
        source: 'history',
        name: cleanName,
        brand: null,
        packGrams: null,
        assumedGrams: null,
        kcal: e.kcal,
        proteinG: e.proteinG,
        carbsG: e.carbsG,
        fatG: e.fatG,
        fiberG: e.fiberG,
        barcode: null,
        imageUrl: null,
      })
      if (historyHits.length >= 6) break
    }

    const offFiltered = offHits.filter(h => {
      const key = foodNameKey(h.name)
      if (!key || seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })
    const products: FoodProductHit[] = [...historyHits, ...offFiltered].slice(0, 14)

    return NextResponse.json({
      query: q,
      products,
      sources: { history: historyHits.length, openfoodfacts: offFiltered.length },
    })
  } catch (err) {
    console.error('[food/products]', err)
    return NextResponse.json({ error: 'product search failed' }, { status: 500 })
  }
}
