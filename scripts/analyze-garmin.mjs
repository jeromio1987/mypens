#!/usr/bin/env node
// Standalone Garmin Analysis Engine runner.
//
// Usage:
//   node scripts/analyze-garmin.mjs              # current ISO week
//   node scripts/analyze-garmin.mjs --last
//   node scripts/analyze-garmin.mjs --all         # entire history in DB
//   node scripts/analyze-garmin.mjs --week=2026-07-15
//
// Requires DATABASE_URL (reads .env). Writes docs/reports/garmin-analysis-<tag>.md

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { weekBounds, shiftDateStr } from './lib/weekDates.mjs'
import { analyzeGarmin, loadGarminData } from './lib/garminAnalyze.mjs'

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
  const args = { week: null, last: false, all: false }
  for (const a of argv.slice(2)) {
    if (a === '--last') args.last = true
    else if (a === '--all') args.all = true
    else if (a.startsWith('--week=')) args.week = a.slice('--week='.length)
  }
  return args
}

function toMarkdown(report) {
  const list = (arr, empty = '_none_') =>
    arr?.length ? arr.map(x => `- ${x}`).join('\n') : empty
  return `# Garmin Analysis Engine

_Window: ${report.weekOf || 'all-time'} → ${report.weekEnd || 'all-time'}_
_Coverage score: ${report.coverageScore}/${report.coverageMax || 7} domains_

## Summary
${report.summary}

## Inventory
\`\`\`json
${JSON.stringify(report.inventory, null, 2)}
\`\`\`

## Findings
${list(report.findings)}

## Risks
${list(report.risks)}

## Wins
${list(report.wins)}

## Domains
\`\`\`json
${JSON.stringify(report.domains, null, 2)}
\`\`\`

## Cross-links (correlations)
\`\`\`json
${JSON.stringify(report.crossLinks, null, 2)}
\`\`\`
`
}

async function main() {
  loadDotEnv(REPO_ROOT)
  if (!process.env.DATABASE_URL) {
    console.error('[garmin-analyze] DATABASE_URL missing')
    process.exit(1)
  }

  const args = parseArgs(process.argv)
  let weekOf = null
  let weekEnd = null
  let allTime = false
  if (args.all) {
    allTime = true
  } else if (args.week) {
    ;({ weekOf, weekEnd } = weekBounds(args.week))
  } else if (args.last) {
    const cur = weekBounds(new Date())
    ;({ weekOf, weekEnd } = weekBounds(shiftDateStr(cur.weekOf, -1)))
  } else {
    ;({ weekOf, weekEnd } = weekBounds(new Date()))
  }

  console.log(
    allTime
      ? '[garmin-analyze] window: ALL TIME'
      : `[garmin-analyze] window: ${weekOf} → ${weekEnd}`,
  )

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const data = await loadGarminData(prisma, { weekOf, weekEnd, allTime })
    const report = analyzeGarmin(data)
    console.log(`[garmin-analyze] coverage ${report.coverageScore}/6`)
    console.log(`[garmin-analyze] findings: ${report.findings.length}, risks: ${report.risks.length}`)
    for (const f of report.findings.slice(0, 8)) console.log(`  • ${f}`)

    const dir = join(REPO_ROOT, 'docs', 'reports')
    mkdirSync(dir, { recursive: true })
    const tag = allTime ? 'all-time' : weekOf
    const path = join(dir, `garmin-analysis-${tag}.md`)
    writeFileSync(path, toMarkdown(report), 'utf8')
    console.log(`[garmin-analyze] wrote ${path}`)
    console.log(JSON.stringify({ inventory: report.inventory, risks: report.risks, wins: report.wins }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('[garmin-analyze] fatal:', err)
  process.exit(1)
})
