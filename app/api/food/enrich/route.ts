import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { consume } from '@/lib/rateLimit'
import {
  enrichmentWritePayload,
  proposeEnrichment,
  type EnrichableEntry,
  type EnrichmentProposal,
} from '@/lib/foodEnrichment'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = {
  id?: string
  date?: string
  from?: string
  to?: string
  /** Persist matches (default false = dry-run review only). */
  apply?: boolean
  /** Also persist weak_match when apply=true (default false). */
  applyWeak?: boolean
  /** Re-enrich rows that already have micros (default false). */
  force?: boolean
  minConfidence?: number
  /** Max entries to process in one call (default 25, max 80). */
  limit?: number
  onlyMissingMicros?: boolean
}

function isYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

async function loadEntries(body: Body): Promise<EnrichableEntry[]> {
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 80)
  const onlyMissing = body.onlyMissingMicros !== false && !body.force

  const where: Record<string, unknown> = {}
  if (body.id) {
    where.id = String(body.id)
  } else if (isYmd(body.date)) {
    where.date = body.date
  } else if (isYmd(body.from) || isYmd(body.to)) {
    where.date = {
      ...(isYmd(body.from) ? { gte: body.from } : {}),
      ...(isYmd(body.to) ? { lte: body.to } : {}),
    }
  } else {
    throw new Error('Provide id, date (yyyy-mm-dd), or from/to range')
  }

  if (onlyMissing) {
    where.OR = [{ microsJson: null }, { microsJson: '' }]
  }

  const rows = await prisma.foodEntry.findMany({
    where,
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    take: onlyMissing ? Math.min(limit * 3, 200) : limit,
  })

  const mapped = rows
    .filter(e => {
      if (!onlyMissing) return true
      const raw = e.microsJson?.trim()
      return !raw || raw === '{}' || raw === 'null'
    })
    .slice(0, limit)

  return mapped.map(e => ({
    id: e.id,
    name: e.name,
    notes: e.notes,
    kcal: e.kcal,
    proteinG: e.proteinG,
    carbsG: e.carbsG,
    fatG: e.fatG,
    fiberG: e.fiberG,
    microsJson: e.microsJson,
    tagsJson: e.tagsJson,
    enrichmentJson: e.enrichmentJson,
  }))
}

async function applyProposal(
  proposal: EnrichmentProposal,
  applyWeak: boolean,
): Promise<'applied' | 'skipped' | 'column_fallback'> {
  const payload = enrichmentWritePayload(proposal, applyWeak)
  if (!payload) return 'skipped'

  try {
    await prisma.foodEntry.update({
      where: { id: proposal.entryId },
      data: {
        microsJson: payload.microsJson,
        tagsJson: payload.tagsJson,
        enrichmentJson: payload.enrichmentJson,
      },
    })
    return 'applied'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/enrichmentJson|Unknown argument|does not exist/i.test(msg)) throw err
    // Pre-migration DB: still persist micros/tags.
    await prisma.foodEntry.update({
      where: { id: proposal.entryId },
      data: {
        microsJson: payload.microsJson,
        tagsJson: payload.tagsJson,
      },
    })
    return 'column_fallback'
  }
}

/**
 * POST /api/food/enrich
 * Dry-run (default) or apply OFF-based micronutrient enrichment for logged foods.
 * Never overwrites kcal/protein/carbs/fat/fiber.
 *
 * Body examples:
 *   { "date": "2026-07-30" }
 *   { "from": "2026-07-01", "to": "2026-07-31", "apply": true }
 *   { "id": "<cuid>", "apply": true, "force": true }
 */
export async function POST(req: Request) {
  try {
    const rl = consume('food-enrich', { capacity: 20, refillPerSec: 20 / 60 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }

    const body = (await req.json().catch(() => ({}))) as Body
    const apply = Boolean(body.apply)
    const applyWeak = Boolean(body.applyWeak)
    const force = Boolean(body.force)
    const minConfidence =
      typeof body.minConfidence === 'number' && Number.isFinite(body.minConfidence)
        ? Math.max(0.35, Math.min(0.95, body.minConfidence))
        : 0.55

    let entries: EnrichableEntry[]
    try {
      entries = await loadEntries(body)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'bad request' },
        { status: 400 },
      )
    }

    const results: Array<EnrichmentProposal & { applied?: string }> = []
    let applied = 0
    let matched = 0
    let weak = 0
    let skipped = 0
    let noMatch = 0

    // Sequential OFF calls — polite to world.openfoodfacts.org on Hobby.
    for (const entry of entries) {
      const proposal = await proposeEnrichment(entry, { force, minConfidence })
      if (proposal.status === 'matched') matched++
      else if (proposal.status === 'weak_match') weak++
      else if (proposal.status === 'no_match') noMatch++
      else skipped++

      let appliedStatus: string | undefined
      if (apply) {
        appliedStatus = await applyProposal(proposal, applyWeak)
        if (appliedStatus === 'applied' || appliedStatus === 'column_fallback') applied++
      }

      results.push({ ...proposal, ...(appliedStatus ? { applied: appliedStatus } : {}) })
    }

    return NextResponse.json({
      dryRun: !apply,
      apply,
      minConfidence,
      force,
      count: entries.length,
      summary: { matched, weak, noMatch, skipped, applied },
      results,
      fills: {
        microsJson: 'scaled OFF micros for estimated portion when matched',
        tagsJson: 're-inferred soft tags + off_enriched when micros applied',
        enrichmentJson: 'provenance/confidence (requires migration; else skipped)',
        macros: 'never overwritten',
      },
      leavesNull: [
        'micros when no/weak OFF match or OFF product has empty nutriments',
        'unknown micro keys not present on the OFF product',
        'USDA / generic recipe estimates (not implemented)',
      ],
    })
  } catch (err) {
    console.error('[food/enrich]', err)
    const detail = err instanceof Error ? err.message : 'enrich failed'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'enrich failed' : detail },
      { status: 500 },
    )
  }
}

/**
 * GET /api/food/enrich?date=yyyy-mm-dd
 * Review status for a day: which entries have micros / enrichment meta.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    if (!isYmd(date)) {
      return NextResponse.json({ error: 'date=yyyy-mm-dd required' }, { status: 400 })
    }

    const entries = await prisma.foodEntry.findMany({
      where: { date },
      orderBy: { createdAt: 'asc' },
    })

    const rows = entries.map(e => {
      const hasMicros = Boolean(e.microsJson && e.microsJson !== '{}' && e.microsJson !== '')
      return {
        id: e.id,
        name: e.name,
        meal: e.meal,
        kcal: e.kcal,
        hasMicros,
        hasEnrichmentMeta: Boolean(e.enrichmentJson),
        enrichmentJson: e.enrichmentJson ?? null,
        tagsJson: e.tagsJson,
      }
    })

    const withMicros = rows.filter(r => r.hasMicros).length
    return NextResponse.json({
      date,
      count: rows.length,
      withMicros,
      missingMicros: rows.length - withMicros,
      entries: rows,
    })
  } catch (err) {
    console.error('[food/enrich GET]', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
