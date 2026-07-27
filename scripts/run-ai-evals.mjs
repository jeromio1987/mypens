#!/usr/bin/env node
/**
 * Runs the live AI evals: loads .env, flips RUN_AI_EVALS on, then hands over to
 * vitest. A plain `RUN_AI_EVALS=1 vitest` line does not work in PowerShell,
 * which is where this repo is actually driven from.
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadDotEnv(root) {
  const p = join(root, '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let val = m[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val
  }
}

loadDotEnv(REPO_ROOT)

if (!process.env.ANTHROPIC_API_KEY?.trim()) {
  console.error('[eval:ai] ANTHROPIC_API_KEY is not set — the live evals would all skip.')
  process.exit(1)
}

console.log('[eval:ai] running live evals against the Anthropic API (this costs tokens)')

const child = spawn(
  process.execPath,
  [join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'tests/ai'],
  {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, RUN_AI_EVALS: '1' },
  },
)

child.on('exit', code => process.exit(code ?? 1))
