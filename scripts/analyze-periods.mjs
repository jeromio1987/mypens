#!/usr/bin/env node
// Period Review runner — multi-horizon advice + causal engine (alcohol lag, …).
//
// Usage:
//   npm run analyze:periods
//   node scripts/analyze-periods.mjs --as-of=2026-07-18
//   node scripts/analyze-periods.mjs --dry
//
// Requires DATABASE_URL. Writes docs/reports/period-review-<asOf>.md
// and upserts PeriodReviewReport (unless --dry).

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadGarminData } from './lib/garminAnalyze.mjs'
import { analyzePeriods, periodsToMarkdown, periodsToHtml } from './lib/periodAnalyze.mjs'
import { loadConfounders } from './lib/periodCausal.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

function loadDotEnv(root) {
  const p = join(root, '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val
  }
}

function parseArgs(argv) {
  const args = { asOf: null, dry: false }
  for (const a of argv.slice(2)) {
    if (a === '--dry') args.dry = true
    else if (a.startsWith('--as-of=')) args.asOf = a.slice('--as-of='.length)
  }
  return args
}

async function main() {
  loadDotEnv(REPO_ROOT)
  if (!process.env.DATABASE_URL) {
    console.error('[period-review] DATABASE_URL missing')
    process.exit(1)
  }

  const args = parseArgs(process.argv)
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const [garmin, confounders] = await Promise.all([
      loadGarminData(prisma, { allTime: true }),
      loadConfounders(prisma, {}),
    ])
    const data = { ...garmin, ...confounders }
    const report = analyzePeriods(data, { asOf: args.asOf || undefined })

    console.log(`[period-review] ${report.headline}`)
    if (report.topHypothesis) {
      console.log(
        `[period-review] leading cause: ${report.topHypothesis.label} (${Math.round(report.topHypothesis.confidence * 100)}%)`,
      )
    }
    for (const h of report.horizons) {
      if (!h.verdict) continue
      const cause = h.causal?.topHypothesis?.label
      console.log(
        `  · ${h.label}: ${h.verdict} (${h.score}/100, ${h.weeks} weeks)` +
          (cause ? ` — cause: ${cause}` : '') +
          (h.nested?.longestGood && h.nested?.longestBad
            ? ` — ${h.nested.longestGood.approxMonths}mo good / ${h.nested.longestBad.approxMonths}mo bad inside`
            : ''),
      )
    }

    const dir = join(REPO_ROOT, 'docs', 'reports')
    mkdirSync(dir, { recursive: true })
    const path = join(dir, `period-review-${report.asOf}.md`)
    const htmlPath = join(dir, `period-review-${report.asOf}.html`)
    writeFileSync(path, periodsToMarkdown(report), 'utf8')
    writeFileSync(htmlPath, periodsToHtml(report), 'utf8')
    console.log(`[period-review] wrote ${path}`)
    console.log(`[period-review] wrote ${htmlPath}`)
    console.log(`[period-review] open: start "" "${htmlPath}"`)

    if (args.dry) {
      console.log('[period-review] --dry: skipped DB upsert')
      return
    }

    if (!prisma.periodReviewReport) {
      console.warn(
        '[period-review] PeriodReviewReport model missing — run prisma migrate/generate, then re-run to persist for /period-review',
      )
      return
    }

    await prisma.periodReviewReport.upsert({
      where: { asOf: report.asOf },
      create: {
        asOf: report.asOf,
        headline: report.headline,
        reportJson: JSON.stringify(report),
        generatedAt: new Date(),
      },
      update: {
        headline: report.headline,
        reportJson: JSON.stringify(report),
        generatedAt: new Date(),
      },
    })
    console.log(`[period-review] upserted PeriodReviewReport asOf=${report.asOf}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('[period-review] fatal:', err)
  process.exit(1)
})
