#!/usr/bin/env node
/**
 * Cursor stop hook: if myPENS paths are dirty, run mobile tsc and follow up loudly on FAIL.
 * Stdin: stop hook JSON. Stdout: {} or { followup_message }.
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

if ((tsc.status ?? 1) === 0) {
  // tsc green: stay silent. Dirty+PASS used to nag every agent turn (incl. ISZE
  // chats in multi-root). Full verify is a ship-skill duty, not a stop spam loop.
  emit({})
  process.exit(0)
}

const errTail = `${tsc.stdout || ''}${tsc.stderr || ''}`
  .split(/\r?\n/)
  .filter((l) => /error TS/.test(l))
  .slice(0, 20)
  .join('\n')

emit({
  followup_message:
    `myPENS stop hook FAIL — \`npx tsc --noEmit\` in mypens-mobile failed. Fix before claiming ship done.\n\n` +
    '```text\n' +
    (errTail || '(no TS lines — see full tsc output in terminal)') +
    '\n```\n\n' +
    'Then run full skill: `node .cursor/skills/mypens-verify-ship/scripts/verify-ship.mjs`',
})
process.exit(0)
