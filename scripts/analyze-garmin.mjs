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

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function toHtml(report) {
  const li = arr =>
    arr?.length ? arr.map(x => `<li>${esc(x)}</li>`).join('') : '<li>none</li>'
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Garmin Analysis — ${esc(report.weekOf || 'all-time')}</title>
<style>
body{margin:0;font:15px/1.55 system-ui,Segoe UI,sans-serif;background:#0b1220;color:#e8eefc}
main{max-width:900px;margin:0 auto;padding:28px 18px 56px}
.card{background:#121a2b;border:1px solid #243049;border-radius:14px;padding:14px 16px;margin:12px 0}
h1{margin:0 0 8px} .muted{color:#93a0b8} pre{overflow:auto;background:#0a0f1a;padding:12px;border-radius:10px;font-size:12px}
ul{margin:6px 0 0;padding-left:1.2rem}
</style></head><body><main>
<h1>Garmin Analysis Engine</h1>
<p class="muted">Window: ${esc(report.weekOf || 'all-time')} → ${esc(report.weekEnd || 'all-time')} · coverage ${report.coverageScore}/${report.coverageMax || 7}</p>
<div class="card"><strong>Summary</strong><p>${esc(report.summary)}</p></div>
<div class="card"><strong>Findings</strong><ul>${li(report.findings)}</ul></div>
<div class="card"><strong>Risks</strong><ul>${li(report.risks)}</ul></div>
<div class="card"><strong>Wins</strong><ul>${li(report.wins)}</ul></div>
<div class="card"><strong>Inventory</strong><pre>${esc(JSON.stringify(report.inventory, null, 2))}</pre></div>
<div class="card"><strong>Domains</strong><pre>${esc(JSON.stringify(report.domains, null, 2))}</pre></div>
<div class="card"><strong>Cross-links</strong><pre>${esc(JSON.stringify(report.crossLinks, null, 2))}</pre></div>
</main></body></html>`
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
    const htmlPath = join(dir, `garmin-analysis-${tag}.html`)
    writeFileSync(path, toMarkdown(report), 'utf8')
    writeFileSync(htmlPath, toHtml(report), 'utf8')
    console.log(`[garmin-analyze] wrote ${path}`)
    console.log(`[garmin-analyze] wrote ${htmlPath}`)
    console.log(`[garmin-analyze] open: start "" "${htmlPath}"`)
    console.log(JSON.stringify({ inventory: report.inventory, risks: report.risks, wins: report.wins }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('[garmin-analyze] fatal:', err)
  process.exit(1)
})
