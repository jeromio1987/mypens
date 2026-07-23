/**
 * Open Food Facts helpers — worldwide product search (strong EU/BE coverage).
 * Not limited to Belgian shops; Delhaize/Colruyt/etc. appear when OFF has them.
 */

export type FoodProductHit = {
  id: string
  source: 'history' | 'openfoodfacts'
  name: string
  brand: string | null
  /** Full pack net weight when parseable. */
  packGrams: number | null
  /** Grams the macros below describe (usually 100). null/history = use macros as-is until user sets grams. */
  assumedGrams: number | null
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  /** OFF barcode when from catalog. */
  barcode?: string | null
  imageUrl?: string | null
}

type OffNutriments = Record<string, number | string | undefined>

type OffProduct = {
  code?: string
  product_name?: string
  product_name_en?: string
  product_name_fr?: string
  product_name_nl?: string
  brands?: string
  quantity?: string
  product_quantity?: number
  product_quantity_unit?: string
  serving_size?: string
  image_front_small_url?: string
  image_small_url?: string
  nutriments?: OffNutriments
}

function num(n: unknown): number | null {
  const v = typeof n === 'string' ? parseFloat(n) : Number(n)
  if (!Number.isFinite(v) || v < 0) return null
  return v
}

/** Parse "1 kg", "450g", "450 g e", "1.5kg" → grams. */
export function parseQuantityToGrams(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.toLowerCase().replace(/,/g, '.').trim()
  const m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|gram|grams|ml|l)\b/)
  if (!m) return null
  const v = parseFloat(m[1])
  const unit = m[2]
  if (!Number.isFinite(v) || v <= 0) return null
  if (unit === 'kg' || unit === 'l') return Math.round(v * 1000)
  // ml ≈ g for diary purposes
  return Math.round(v)
}

function pickName(p: OffProduct): string {
  const n =
    p.product_name?.trim() ||
    p.product_name_nl?.trim() ||
    p.product_name_fr?.trim() ||
    p.product_name_en?.trim() ||
    ''
  return n.slice(0, 120)
}

function macrosPer100g(n: OffNutriments | undefined): {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
} | null {
  if (!n) return null
  const kcal =
    num(n['energy-kcal_100g']) ??
    num(n['energy-kcal']) ??
    (num(n['energy_100g']) != null ? Math.round(Number(n['energy_100g']) / 4.184) : null)
  if (kcal == null || kcal <= 0) return null
  return {
    kcal: Math.round(kcal),
    proteinG: Math.round((num(n['proteins_100g']) ?? 0) * 10) / 10,
    carbsG: Math.round((num(n['carbohydrates_100g']) ?? 0) * 10) / 10,
    fatG: Math.round((num(n['fat_100g']) ?? 0) * 10) / 10,
    fiberG: Math.round((num(n['fiber_100g']) ?? 0) * 10) / 10,
  }
}

export function mapOffProduct(p: OffProduct): FoodProductHit | null {
  const name = pickName(p)
  if (!name) return null
  const macros = macrosPer100g(p.nutriments)
  if (!macros) return null

  let packGrams =
    parseQuantityToGrams(p.quantity) ??
    (p.product_quantity != null && p.product_quantity_unit
      ? parseQuantityToGrams(`${p.product_quantity} ${p.product_quantity_unit}`)
      : null)
  if (packGrams == null && typeof p.product_quantity === 'number' && p.product_quantity > 0) {
    // OFF sometimes stores grams in product_quantity with unit missing
    packGrams = p.product_quantity > 20 && p.product_quantity < 10000 ? Math.round(p.product_quantity) : null
  }

  const brand = p.brands?.split(',')[0]?.trim() || null
  const code = p.code ? String(p.code) : null

  return {
    id: code ? `off:${code}` : `off:${name.toLowerCase()}:${brand ?? ''}`,
    source: 'openfoodfacts',
    name: brand ? `${brand} ${name}`.replace(/\s+/g, ' ').trim() : name,
    brand,
    packGrams,
    assumedGrams: 100,
    ...macros,
    barcode: code,
    imageUrl: p.image_front_small_url || p.image_small_url || null,
  }
}

/**
 * Search Open Food Facts (world index — includes Belgian brands when present).
 */
export async function searchOpenFoodFacts(
  query: string,
  opts: { pageSize?: number; signal?: AbortSignal } = {},
): Promise<FoodProductHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const pageSize = Math.min(Math.max(opts.pageSize ?? 8, 1), 20)
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1` +
    `&page_size=${pageSize}`

  const res = await fetch(url, {
    signal: opts.signal,
    headers: {
      'User-Agent': 'MyPens/1.0 (personal food diary; contact: local)',
      Accept: 'application/json',
    },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { products?: OffProduct[] }
  const products = Array.isArray(data.products) ? data.products : []
  const out: FoodProductHit[] = []
  const seen = new Set<string>()
  for (const p of products) {
    const hit = mapOffProduct(p)
    if (!hit) continue
    if (seen.has(hit.id)) continue
    seen.add(hit.id)
    out.push(hit)
    if (out.length >= pageSize) break
  }
  return out
}
