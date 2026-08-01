#!/usr/bin/env node
/**
 * Cursor stop hook: if myPENS paths are dirty, run mobile tsc + wiring-check.
 * Stdin: stop hook JSON. Stdout: {} or { followup_message }.
 * Does not run full verify-ship (ship-skill duty). Avoids silent PASS spam.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8')
  } catch {
    return '{}'
  }
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj))
}

function findMypens(workspaceRoots) {
  const candidates = []
  for (const root of workspaceRoots || []) {
    candidates.push(path.join(root, 'Projects', 'mypens'))
    candidates.push(path.join(root, '..', 'Projects', 'mypens'))
    candidates.push(path.join(root, 'mypens'))
    if (path.basename(root).toLowerCase() === 'mypens') candidates.push(root)
  }
  candidates.push('C:\\Users\\jerom\\Desktop\\claude\\Projects\\mypens')
  for (const c of candidates) {
    try {
      const resolved = path.resolve(c)
      if (fs.existsSync(path.join(resolved, 'mypens-mobile', 'package.json'))) return resolved
    } catch {
      /* skip */
    }
  }
  return null
}

function mypensDirty(mypens) {
  const r = spawnSync('git', ['-C', mypens, 'status', '--porcelain', '--', 'mypens-mobile', 'app', 'lib', 'components', '.cursor'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 20_000,
  })
  if (r.error || (r.status ?? 1) !== 0) {
    // If git fails, still check skill/script edits under this hook's tree
    return true
  }
  const lines = (r.stdout || '').split(/\r?\n/).filter(Boolean)
  return lines.some((l) => {
    const p = l.slice(3).replace(/\\/g, '/')
    return (
      p.includes('mypens-mobile/') ||
      p.startsWith('app/api/food') ||
      p.startsWith('app/api/energy') ||
      p.startsWith('app/api/weight') ||
      p.startsWith('app/api/period-review') ||
      p.startsWith('lib/food') ||
      p.startsWith('lib/energy') ||
      p.includes('.cursor/skills/mypens-verify-ship') ||
      p.includes('.cursor/skills/mypens-adversarial-pre-apk') ||
      p.includes('.cursor/rules/mypens-') ||
      p.includes('.cursor/hooks/mypens')
    )
  })
}

const raw = readStdin()
let input = {}
try {
  input = JSON.parse(raw || '{}')
} catch {
  input = {}
}

if (input.status === 'aborted') {
  emit({})
  process.exit(0)
}

const loopCount = Number(input.loop_count ?? 0)
if (loopCount >= 2) {
  // avoid infinite verify loops
  emit({})
  process.exit(0)
}

const mypens = findMypens(input.workspace_roots)
if (!mypens || !mypensDirty(mypens)) {
  emit({})
  process.exit(0)
}

const mobile = path.join(mypens, 'mypens-mobile')
const tsc = spawnSync('npx', ['tsc', '--noEmit'], {
  cwd: mobile,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  timeout: 180_000,
})
const tscOk = (tsc.status ?? 1) === 0

const wiringScript = path.join(
  mypens,
  '.cursor',
  'skills',
  'mypens-adversarial-pre-apk',
  'scripts',
  'wiring-check.mjs',
)
let wiringOk = true
let wiringTail = ''
if (fs.existsSync(wiringScript)) {
  const wiring = spawnSync('node', [wiringScript], {
    cwd: mypens,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 60_000,
  })
  wiringOk = (wiring.status ?? 1) === 0
  wiringTail = `${wiring.stdout || ''}${wiring.stderr || ''}`
    .split(/\r?\n/)
    .filter((l) => /^(FAIL|PASS|  ✗|  ·|===)/.test(l) || l.includes('W1') || l.includes('W2') || l.includes('W3') || l.includes('W4'))
    .slice(0, 40)
    .join('\n')
}

if (tscOk && wiringOk) {
  // Stay silent on green — full verify-ship remains a ship-skill duty.
  emit({})
  process.exit(0)
}

const parts = []
parts.push('myPENS stop hook FAIL — fix before claiming ship done.')

if (!tscOk) {
  const errTail = `${tsc.stdout || ''}${tsc.stderr || ''}`
    .split(/\r?\n/)
    .filter((l) => /error TS/.test(l))
    .slice(0, 20)
    .join('\n')
  parts.push(
    '\n### mobile tsc\n```text\n' +
      (errTail || '(no TS lines — see full tsc output in terminal)') +
      '\n```',
  )
}

if (!wiringOk) {
  parts.push(
    '\n### wiring-check\n```text\n' +
      (wiringTail || '(wiring-check failed — run script manually)') +
      '\n```\n' +
      'Skill: `.cursor/skills/mypens-adversarial-pre-apk/SKILL.md`',
  )
}

parts.push(
  '\nThen: `node .cursor/skills/mypens-adversarial-pre-apk/scripts/wiring-check.mjs` ' +
    '→ `node .cursor/skills/mypens-verify-ship/scripts/verify-ship.mjs`',
)

emit({ followup_message: parts.join('\n') })
process.exit(0)
