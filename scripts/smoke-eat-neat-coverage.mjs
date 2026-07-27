/**
 * Smoke training + daily metrics coverage (no secrets).
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

for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!m) continue
  process.env[m[1]] = stripQuotes(m[2])
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const date = process.argv[2] || '2026-07-26'

try {
  const trainings = await prisma.trainingEntry.findMany({
    where: { date },
    select: { exercise: true, calories: true, source: true, notes: true },
  })
  const recent = await prisma.trainingEntry.findMany({
    where: { date: { gte: '2026-07-20' } },
    select: { date: true, exercise: true, calories: true, source: true },
    orderBy: { date: 'desc' },
    take: 30,
  })
  const bySource = await prisma.trainingEntry.groupBy({
    by: ['source'],
    where: { date: { gte: '2026-07-01' } },
    _count: true,
    _sum: { calories: true },
  })
  const dailyToday = await prisma.garminDailyMetric.findMany({
    where: { date },
    select: { kind: true, valueNum: true },
  })
  const dailyKinds = await prisma.garminDailyMetric.groupBy({
    by: ['kind'],
    _count: true,
  })
  const dailyRecent = await prisma.garminDailyMetric.findMany({
    where: { kind: { in: ['steps', 'active_calories'] }, date: { gte: '2026-07-01' } },
    orderBy: { date: 'desc' },
    take: 20,
    select: { date: true, kind: true, valueNum: true },
  })
  const garminActs = await prisma.garminActivity.count({ where: { date: { gte: '2026-07-01' } } })

  console.log(
    JSON.stringify(
      {
        date,
        trainingToday: trainings.map((t) => ({
          exercise: t.exercise,
          cal: t.calories,
          source: t.source,
        })),
        recentTrainings: recent,
        bySourceJul: bySource,
        dailyToday,
        dailyKinds,
        dailyRecentStepsActive: dailyRecent,
        garminActsSinceJul1: garminActs,
      },
      null,
      2,
    ),
  )
} catch (e) {
  console.log(JSON.stringify({ err: String(e?.message || e).slice(0, 500) }))
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
