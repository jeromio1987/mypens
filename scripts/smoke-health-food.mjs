/**
 * Smoke: /api/health must stay 200, and if food is 500 while health 200 → fail
 * (classic Next wedge: health env-only, Prisma broken).
 *
 * Usage: node scripts/smoke-health-food.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = (process.env.PENS_SMOKE_BASE || 'http://127.0.0.1:5000').replace(/\/$/, '')

function stripQuotes(v) {
  let out = String(v ?? '').trim()
  while (
    (out.startsWith('"') && out.endsWith('"') && out.length >= 2) ||
    (out.startsWith("'") && out.endsWith("'") && out.length >= 2)
  ) {
    out = out.slice(1, -1).trim()
  }
  return out
}

function loadEnv(file) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    if (process.env[m[1]] === undefined) process.env[m[1]] = stripQuotes(m[2])
  }
}

loadEnv('.env')
const token = stripQuotes(process.env.MOBILE_PENS_API_TOKEN || '')

async function get(pathName, headers = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(`${base}${pathName}`, { headers, signal: ctrl.signal })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* ignore */
    }
    return { status: res.status, ok: res.ok, json, text: text.slice(0, 120) }
  } finally {
    clearTimeout(t)
  }
}

const health = await get('/api/health')
console.log(
  JSON.stringify({
    healthStatus: health.status,
    healthOk: health.ok,
    dbOk: health.json?.dbOk ?? null,
    dbMs: health.json?.dbMs ?? null,
    hasDatabaseUrl: health.json?.env?.hasDatabaseUrl ?? null,
  }),
)

if (!health.ok) {
  console.error('FAIL: /api/health not OK')
  process.exit(1)
}

if (!token) {
  console.log(JSON.stringify({ food: 'skip_no_token' }))
  process.exit(0)
}

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const food = await get(`/api/food?date=${today}`, {
  Authorization: `Bearer ${token}`,
})
console.log(
  JSON.stringify({
    foodStatus: food.status,
    foodOk: food.ok,
    bodyStart: food.text,
  }),
)

if (health.ok && food.status >= 500) {
  console.error('FAIL: health 200 but food 5xx — likely Prisma / DATABASE_URL wedge')
  process.exit(1)
}

if (health.json?.dbOk === false) {
  console.error('FAIL: health.dbOk=false — DATABASE_URL or Prisma connection broken')
  process.exit(1)
}

console.log(JSON.stringify({ smoke: 'pass' }))
