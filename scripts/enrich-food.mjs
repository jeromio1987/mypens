#!/usr/bin/env node
/**
 * CLI wrapper for POST /api/food/enrich
 *
 * Usage (PowerShell):
 *   node scripts/enrich-food.mjs --date=2026-07-30
 *   node scripts/enrich-food.mjs --date=2026-07-30 --apply
 *   node scripts/enrich-food.mjs --from=2026-07-01 --to=2026-07-31 --apply --limit=40
 *   node scripts/enrich-food.mjs --id=<cuid> --force --apply
 *
 * Env: MYPENS_BASE_URL (default http://127.0.0.1:5000)
 */

const base = (process.env.MYPENS_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '')

function arg(name) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  if (hit) return hit.slice(name.length + 3)
  if (process.argv.includes(`--${name}`)) return true
  return undefined
}

async function main() {
  const body = {
    apply: Boolean(arg('apply')),
    force: Boolean(arg('force')),
    applyWeak: Boolean(arg('applyWeak')),
  }
  const id = arg('id')
  const date = arg('date')
  const from = arg('from')
  const to = arg('to')
  const limit = arg('limit')
  const minConfidence = arg('minConfidence')
  if (id && id !== true) body.id = id
  if (date && date !== true) body.date = date
  if (from && from !== true) body.from = from
  if (to && to !== true) body.to = to
  if (limit && limit !== true) body.limit = Number(limit)
  if (minConfidence && minConfidence !== true) body.minConfidence = Number(minConfidence)

  if (!body.id && !body.date && !body.from && !body.to) {
    console.error('Need --date=YYYY-MM-DD or --from/--to or --id=...')
    process.exit(1)
  }

  const res = await fetch(`${base}/api/food/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    console.error(res.status, text.slice(0, 400))
    process.exit(1)
  }
  if (!res.ok) {
    console.error(res.status, json)
    process.exit(1)
  }

  console.log(JSON.stringify({
    dryRun: json.dryRun,
    summary: json.summary,
    count: json.count,
    fills: json.fills,
    sample: (json.results || []).slice(0, 5).map(r => ({
      entryId: r.entryId,
      status: r.status,
      confidence: r.confidence,
      completeness: r.completeness,
      microKeys: Object.keys(r.micros || {}),
      matched: r.meta?.matchedName,
      applied: r.applied,
      reason: r.reason,
    })),
  }, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
