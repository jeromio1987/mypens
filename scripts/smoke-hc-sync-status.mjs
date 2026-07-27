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
const c = await prisma.healthConnectConnection.findFirst({
  select: { lastSyncAt: true, lastError: true, lastErrorAt: true },
})
const after18 = await prisma.garminDailyMetric.findMany({
  where: {
    kind: { in: ['steps', 'active_calories'] },
    date: { gte: '2026-07-19' },
  },
  orderBy: { date: 'asc' },
  select: { date: true, kind: true, valueNum: true, sourceFile: true },
})
const recentHc = await prisma.trainingEntry.findMany({
  where: {
    source: 'healthconnect',
    createdAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  },
  select: { date: true, exercise: true, calories: true, createdAt: true },
  orderBy: { createdAt: 'desc' },
  take: 10,
})
console.log(
  JSON.stringify(
    {
      hc: c,
      stepsOrActiveAfterJul18: after18,
      hcTrainingsCreatedLast3h: recentHc,
    },
    null,
    2,
  ),
)
await prisma.$disconnect()
