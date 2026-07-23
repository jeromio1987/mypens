#!/usr/bin/env node
// Offline multi-source engine stress test (no DATABASE_URL required).
//
//   npm run test:engines
//   node scripts/test-engines-detailed.mjs
//
// Writes docs/reports/engine-stress-test.md and exits 1 if any check fails.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runEngineStressTest, stressTestToMarkdown } from './lib/engineStressTest.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

function main() {
  const report = runEngineStressTest()
  const md = stressTestToMarkdown(report)
  const dir = join(REPO_ROOT, 'docs', 'reports')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'engine-stress-test.md')
  writeFileSync(path, md, 'utf8')

  console.log(`[engine-stress] ${report.summary.passed}/${report.summary.total} passed (${report.summary.passRate}%)`)
  console.log(`[engine-stress] wrote ${path}`)
  for (const c of report.checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.id} — ${c.detail}`)
  }
  if (report.failed.length) {
    console.error(`[engine-stress] ${report.failed.length} failure(s)`)
    process.exit(1)
  }
}

main()
