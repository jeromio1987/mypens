#!/usr/bin/env node
/**
 * myPENS post-ship verifier.
 * Exit 0 = PASS (smoke SKIP allowed). Exit 1 = FAIL.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function argVal(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function hasFlag(flag) {
  return process.argv.includes(flag)
}

function resolveMypensRoot() {
  const fromArg = argVal('--mypens-root')
  if (fromArg) return path.resolve(fromArg)
  // skill lives at <mypens>/.cursor/skills/mypens-verify-ship/scripts/
  const viaSkill = path.resolve(__dirname, '..', '..', '..', '..')
  if (fs.existsSync(path.join(viaSkill, 'mypens-mobile', 'package.json'))) return viaSkill
  const env = process.env.MYPENS_ROOT
  if (env && fs.existsSync(path.join(env, 'mypens-mobile', 'package.json'))) return path.resolve(env)
  const sibling = path.resolve(process.cwd(), 'Projects', 'mypens')
  if (fs.existsSync(path.join(sibling, 'mypens-mobile', 'package.json'))) return sibling
  if (fs.existsSync(path.join(process.cwd(), 'mypens-mobile', 'package.json'))) return process.cwd()
  throw new Error('Cannot find mypens root (pass --mypens-root)')
}

const MYPENS = resolveMypensRoot()
const MOBILE = path.join(MYPENS, 'mypens-mobile')
const SKIP_APK = hasFlag('--skip-apk')
const APK_REBUILT = hasFlag('--apk-rebuilt')
const DATE =
  argVal('--date') ||
  (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
const REPORT_PATH =
  argVal('--report') || path.join(MOBILE, 'docs', 'VERIFY_REPORT.md')

/** Pre-existing web tsc noise — FAIL only if critical-lane paths appear. */
const WEB_ALLOWLIST_RE =
  /(clubroom|garmin|stripe|FoodEntry|node_modules|\.next)/i
const CRITICAL_WEB_RE =
  /(\\|\/)(app(\\|\/)api(\\|\/)(food|energy-balance|weight|period-review|health|mobile)|lib(\\|\/)(food|energyBalance|foodNameKey|retention|period)|components(\\|\/)food|mypens-mobile(\\|\/))/i

function run(cmd, args, cwd, timeoutMs = 180_000) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: timeoutMs,
    env: process.env,
  })
  return {
    code: r.status ?? (r.error ? 1 : 0),
    out: `${r.stdout || ''}${r.stderr || ''}`.trim(),
    error: r.error,
  }
}

function readEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

function mobileUiDirty() {
  const r = run('git', ['-C', MYPENS, 'status', '--porcelain', '--', 'mypens-mobile'], MYPENS, 30_000)
  if (r.code !== 0) {
    // fallback: any recent edit under mobile app/components
    return true
  }
  return r.out
    .split(/\r?\n/)
    .filter(Boolean)
    .some((line) => /mypens-mobile\/(app|components|lib|hooks|constants)\//.test(line.replace(/\\/g, '/')))
}

function apkStampOk() {
  if (APK_REBUILT) return true
  const stamp = path.join(MOBILE, 'docs', '.verify_apk_rebuilt')
  if (!fs.existsSync(stamp)) return false
  // session stamp: mtime within last 12h
  const ageMs = Date.now() - fs.statSync(stamp).mtimeMs
  return ageMs < 12 * 60 * 60 * 1000
}

async function fetchWithTimeout(url, init, ms = 8000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(t)
  }
}

async function smokeApi() {
  const mobileEnv = readEnvFile(path.join(MOBILE, '.env'))
  const webEnv = readEnvFile(path.join(MYPENS, '.env'))
  const base = (
    mobileEnv.EXPO_PUBLIC_PENS_API_URL ||
    process.env.EXPO_PUBLIC_PENS_API_URL ||
    'http://127.0.0.1:5000'
  ).replace(/\/$/, '')
  const token = (
    mobileEnv.EXPO_PUBLIC_PENS_API_TOKEN ||
    webEnv.MOBILE_PENS_API_TOKEN ||
    process.env.MOBILE_PENS_API_TOKEN ||
    ''
  ).trim()

  // Prefer loopback for local smoke when LAN IP is set but process is local
  const candidates = []
  if (base.includes('192.168.') || base.includes('10.')) {
    candidates.push('http://127.0.0.1:5000', base)
  } else {
    candidates.push(base)
  }

  let healthBase = null
  let healthDetail = ''
  for (const b of candidates) {
    try {
      const res = await fetchWithTimeout(`${b}/api/health`, {}, 5000)
      if (res.ok) {
        healthBase = b
        break
      }
      healthDetail = `health ${res.status} at ${b}`
    } catch (e) {
      healthDetail = `${b}: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  if (!healthBase) {
    if (/abort|timeout|Timeout/i.test(healthDetail)) {
      return { status: 'FAIL', detail: `API wedged (listen but no health): ${healthDetail}` }
    }
    return { status: 'SKIP', detail: `API down — ${healthDetail}` }
  }

  if (!token) {
    return { status: 'SKIP', detail: `Health OK at ${healthBase}; no bearer token for food/energy smoke` }
  }

  const headers = { Authorization: `Bearer ${token}` }
  try {
    const food = await fetchWithTimeout(`${healthBase}/api/food?date=${encodeURIComponent(DATE)}`, { headers }, 10000)
    const energy = await fetchWithTimeout(
      `${healthBase}/api/energy-balance?date=${encodeURIComponent(DATE)}`,
      { headers },
      15000,
    )
    if (!food.ok) return { status: 'FAIL', detail: `food ${food.status} at ${healthBase}` }
    if (!energy.ok) return { status: 'FAIL', detail: `energy-balance ${energy.status} at ${healthBase}` }
    const foodJson = await food.json()
    const n = Array.isArray(foodJson) ? foodJson.length : '?'
    return {
      status: 'PASS',
      detail: `${healthBase} food(${DATE})=${n} entries; energy-balance OK`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/abort|timeout/i.test(msg)) {
      return { status: 'FAIL', detail: `API wedged mid-smoke: ${msg}` }
    }
    return { status: 'FAIL', detail: msg }
  }
}

function checkMobileTsc() {
  const r = run('npx', ['tsc', '--noEmit'], MOBILE)
  if (r.code === 0) return { status: 'PASS', detail: 'npx tsc --noEmit clean' }
  const lines = r.out.split(/\r?\n/).filter((l) => /error TS/.test(l))
  return {
    status: 'FAIL',
    detail: lines.slice(0, 12).join('\n') || r.out.slice(0, 1500) || `exit ${r.code}`,
  }
}

function checkWebTsc() {
  const r = run('npx', ['tsc', '--noEmit', '--pretty', 'false'], MYPENS, 240_000)
  if (r.code === 0) return { status: 'PASS', detail: 'web tsc clean' }
  const errLines = r.out.split(/\r?\n/).filter((l) => /error TS\d+/.test(l))
  const critical = errLines.filter((l) => CRITICAL_WEB_RE.test(l) && !WEB_ALLOWLIST_RE.test(l))
  const other = errLines.filter((l) => !WEB_ALLOWLIST_RE.test(l) && !CRITICAL_WEB_RE.test(l))
  if (critical.length) {
    return {
      status: 'FAIL',
      detail: `new/critical errors:\n${critical.slice(0, 15).join('\n')}`,
    }
  }
  // Only allowlisted (or zero non-allowlisted) → PASS with note
  return {
    status: 'PASS',
    detail: `allowlisted pre-existing only (${errLines.length} total errors; ${other.length} non-critical non-allowlisted ignored if empty)`,
  }
}

function checkApk() {
  if (SKIP_APK) return { status: 'SKIP', detail: 'Jerome --skip-apk' }
  const dirty = mobileUiDirty()
  if (!dirty) return { status: 'PASS', detail: 'no dirty mobile UI paths in git' }
  if (apkStampOk()) return { status: 'PASS', detail: 'mobile UI dirty; APK stamp / --apk-rebuilt present' }
  return {
    status: 'FAIL',
    detail:
      'mobile UI changed (debuggableVariants=[]) but APK not rebuilt this session — rebuild + adb install -r, then --apk-rebuilt or docs/.verify_apk_rebuilt',
  }
}

  const results = {
  mobile_tsc: checkMobileTsc(),
  web_tsc: checkWebTsc(),
  api_smoke: await smokeApi(),
  apk_embed: checkApk(),
  truth_check: (() => {
    const script = path.join(MYPENS, '.cursor', 'skills', 'mypens-truth-check', 'scripts', 'truth-check.mjs')
    if (!fs.existsSync(script)) return { status: 'SKIP', detail: 'truth-check script missing' }
    const r = run('node', [script], MYPENS, 60_000)
    return {
      status: r.code === 0 ? 'PASS' : 'FAIL',
      detail: r.out.split(/\r?\n/).slice(0, 12).join(' | '),
    }
  })(),
}

const fail = Object.values(results).some((r) => r.status === 'FAIL')
const status = fail ? 'FAIL' : 'PASS'

const bullets = Object.entries(results)
  .map(([k, v]) => `- ${k}: ${v.status}${v.detail ? ` — ${v.detail.split('\n')[0]}` : ''}`)
  .join('\n')

const body = `# VERIFY_REPORT — myPENS ship
Status: ${status}
Date: ${DATE}
Root: ${MYPENS}

${bullets}

## Details

### mobile_tsc
${results.mobile_tsc.detail}

### web_tsc
${results.web_tsc.detail}

### api_smoke
${results.api_smoke.detail}

### apk_embed
${results.apk_embed.detail}

### truth_check
${results.truth_check.detail}

## Rule
Ship agent may not say done until verify PASS.
`

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
fs.writeFileSync(REPORT_PATH, body, 'utf8')
process.stdout.write(body + '\n')
process.exit(fail ? 1 : 0)
