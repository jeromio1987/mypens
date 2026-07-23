#!/usr/bin/env node
// Offline multi-source engine stress test (no DATABASE_URL required).
//
//   npm run test:engines
//   node scripts/test-engines-detailed.mjs
//
// Writes:
//   docs/reports/engine-stress-test.md
//   docs/reports/engine-stress-test.html  ← open this in a browser
//
// Exits 1 if any check fails.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

import { runEngineStressTest, stressTestToMarkdown, stressTestToHtml } from './lib/engineStressTest.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

function tryOpen(filePath) {
  // Best-effort: open HTML in the default browser (Windows / macOS / Linux).
  const platform = process.platform
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', filePath], { detached: true, stdio: 'ignore' }).unref()
    } else if (platform === 'darwin') {
      spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' }).unref()
    }
  } catch {
    // ignore — user can open manually
  }
}

function main() {
  const report = runEngineStressTest()
  const md = stressTestToMarkdown(report)
  const html = stressTestToHtml(report)
  const dir = join(REPO_ROOT, 'docs', 'reports')
  mkdirSync(dir, { recursive: true })
  const mdPath = join(dir, 'engine-stress-test.md')
  const htmlPath = join(dir, 'engine-stress-test.html')
  writeFileSync(mdPath, md, 'utf8')
  writeFileSync(htmlPath, html, 'utf8')

  console.log(`[engine-stress] ${report.summary.passed}/${report.summary.total} passed (${report.summary.passRate}%)`)
  console.log(`[engine-stress] wrote ${mdPath}`)
  console.log(`[engine-stress] wrote ${htmlPath}`)
  console.log(`[engine-stress] open with:  start "" "${htmlPath}"`)
  for (const c of report.checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.id} — ${c.detail}`)
  }

  if (process.argv.includes('--open')) tryOpen(htmlPath)

  if (report.failed.length) {
    console.error(`[engine-stress] ${report.failed.length} failure(s)`)
    process.exit(1)
  }
}

main()
