# Food nutritional review / enrichment engine

**Verdict:** build (reuse Open Food Facts already in myPENS) — not USDA/paid APIs for a solo Vercel + Supabase app.

Reverse-engineers micros for **already-logged** `FoodEntry` rows from name + macros (+ notes). **Never overwrites** kcal / protein / carbs / fat / fiber.

## What it fills

| Field | Behavior |
|--------|----------|
| `microsJson` | Scaled OFF micros for estimated portion (sodium, K, Ca, Fe, Mg, C, D, B12, Zn — only keys OFF has) |
| `tagsJson` | Re-inferred soft tags + `off_enriched` when micros applied |
| `enrichmentJson` | Provenance: product id, barcode, confidence, nameFit, macroFit, estimatedGrams, completeness (needs migration below) |
| Macros | **Left unchanged** |

## What stays null

- Micros when OFF has no hit, confidence &lt; floor, or product nutriments empty
- Micro keys not present on that OFF product
- Generics / homemade meals without a catalog match (no USDA fallback yet)
- Mobile still won’t *save* micros on new logs until the Expo client is fixed (enrichment API can backfill them)

## One-shot curl (dry-run, then apply)

Dev server on port 5000:

```bash
# Review one day (no writes)
curl -s -X POST http://127.0.0.1:5000/api/food/enrich ^
  -H "Content-Type: application/json" ^
  -d "{\"date\":\"2026-07-30\"}"

# Persist matches for that day
curl -s -X POST http://127.0.0.1:5000/api/food/enrich ^
  -H "Content-Type: application/json" ^
  -d "{\"date\":\"2026-07-30\",\"apply\":true}"

# Date range (max 80 entries / call)
curl -s -X POST http://127.0.0.1:5000/api/food/enrich ^
  -H "Content-Type: application/json" ^
  -d "{\"from\":\"2026-07-01\",\"to\":\"2026-07-31\",\"apply\":true,\"limit\":50}"

# Day coverage board
curl -s "http://127.0.0.1:5000/api/food/enrich?date=2026-07-30"
```

Or: `node scripts/enrich-food.mjs --date=2026-07-30` then `--apply`.

## Body knobs

| Field | Default | Meaning |
|--------|---------|---------|
| `id` / `date` / `from`+`to` | — | Scope (required one of) |
| `apply` | `false` | Persist micros/tags/(enrichmentJson) |
| `applyWeak` | `false` | Also persist `weak_match` |
| `force` | `false` | Re-match rows that already have micros |
| `minConfidence` | `0.55` | Threshold for `matched` (floor 0.35 for candidates) |
| `onlyMissingMicros` | `true` unless `force` | Skip rows with microsJson |
| `limit` | `25` (max 80) | Cap per request (OFF rate politeness) |

## Migration (optional but recommended)

```bash
npx prisma migrate deploy
# or locally: npx prisma db push
```

Migration: `prisma/migrations/20260731193000_food_enrichment_json/`. Without it, apply still writes `microsJson`/`tagsJson` and skips `enrichmentJson`.

## Architecture

1. Build query from `foodNameKey(name + notes)` (portion grams stripped)
2. `searchOpenFoodFacts`
3. Score: name overlap (~45%) + macro fit via kcal→grams estimate (~50%) + micro presence boost
4. Scale OFF per-100g micros → estimated portion
5. Dry-run returns proposals; `apply:true` PATCHes DB without touching macros

Code: `lib/foodEnrichment.ts`, `app/api/food/enrich/route.ts`.

## Remaining gaps

- **Mobile:** Expo food save still omits micros — new logs from phone stay macro-only until client posts micros; use this API to backfill
- **UI:** no accept/reject review screen yet (API-only)
- **Barcode / USDA:** not wired
- **Homemade / restaurant:** often `no_match` — expected
- **History product suggest:** still drops stored micros when suggesting re-log
