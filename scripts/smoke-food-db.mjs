/**
 * Smoke: Prisma can query food + optional authenticated /api/food.
 * Prints status only — no secrets.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'package.json'))

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

function loadEnv(file, { overwrite = false } = {}) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    const v = stripQuotes(m[2])
    if (overwrite || process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

// Process env may hold a quote-wrapped DATABASE_URL that beats .env — always prefer file.
loadEnv('.env', { overwrite: true })
process.env.DATABASE_URL = stripQuotes(process.env.DATABASE_URL || '')

const url = process.env.DATABASE_URL || ''
console.log(
  JSON.stringify({
    dbOk: /^postgres(ql)?:\/\//i.test(url),
    dbLen: url.length,
  }),
)

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

try {
  const n = await prisma.foodEntry.count()
  console.log(JSON.stringify({ prismaFoodCount: n, prismaOk: true }))
} catch (e) {
  console.log(
    JSON.stringify({
      prismaOk: false,
      err: String(e?.message || e).slice(0, 200),
    }),
  )
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}

const token = (process.env.MOBILE_PENS_API_TOKEN || '').trim()
if (!token) {
  console.log(JSON.stringify({ apiFood: 'skip_no_token' }))
  process.exit()
}

const res = await fetch('http://127.0.0.1:5000/api/food?date=2026-07-26', {
  headers: { Authorization: `Bearer ${token}` },
})
const body = await res.text()
console.log(
  JSON.stringify({
    apiFoodStatus: res.status,
    apiFoodOk: res.ok,
    bodyStart: body.slice(0, 80),
  }),
)
