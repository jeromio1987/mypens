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

for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!m) continue
  process.env[m[1]] = stripQuotes(m[2])
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const rows = await prisma.garminDailyMetric.findMany({
  where: { kind: 'steps', date: { gte: '2026-07-10' } },
  orderBy: { date: 'asc' },
  select: { date: true, valueNum: true, sourceFile: true },
})
console.log(JSON.stringify(rows, null, 2))
await prisma.$disconnect()
