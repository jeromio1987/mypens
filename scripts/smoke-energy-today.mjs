/**
 * Smoke: what energy-balance sees for today — counts only, no secrets.
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

function loadEnv(file) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    process.env[m[1]] = stripQuotes(m[2])
  }
}

loadEnv('.env')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const date = process.argv[2] || '2026-07-26'

try {
  const trainings = await prisma.trainingEntry.findMany({
    where: { date },
    select: { id: true, calories: true, durationMin: true, source: true, exercise: true },
  })

  let garminActs = []
  try {
    garminActs = await prisma.garminActivity.findMany({
      where: { date },
      select: { id: true, sport: true, calories: true, name: true },
    })
  } catch {
    garminActs = []
  }

  let metrics = []
  try {
    metrics = await prisma.garminDailyMetric.findMany({
      where: {
        date,
        kind: {
          in: ['steps', 'total_steps', 'active_calories', 'calories', 'resting_calories', 'total_calories'],
        },
      },
      select: { kind: true, valueNum: true },
    })
  } catch (e) {
    metrics = [{ err: String(e?.message || e).slice(0, 120) }]
  }

  let metricTotals = { total: 0, kinds: [] }
  try {
    metricTotals = {
      total: await prisma.garminDailyMetric.count(),
      kinds: await prisma.garminDailyMetric.groupBy({ by: ['kind'], _count: true }),
    }
  } catch {
    metricTotals = { total: -1, kinds: [] }
  }

  const food = await prisma.foodEntry.aggregate({
    where: { date },
    _sum: { kcal: true },
    _count: true,
  })

  const recentWithCal = await prisma.trainingEntry.count({
    where: { calories: { gt: 0 }, date: { gte: '2026-07-01' } },
  })
  const recentNoCal = await prisma.trainingEntry.count({
    where: {
      OR: [{ calories: null }, { calories: 0 }],
      date: { gte: '2026-07-01' },
    },
  })
  const bySource = await prisma.trainingEntry.groupBy({
    by: ['source'],
    where: { date: { gte: '2026-07-01' } },
    _count: true,
    _sum: { calories: true },
  })

  console.log(
    JSON.stringify(
      {
        date,
        foodCount: food._count,
        foodKcal: food._sum.kcal,
        trainingToday: trainings.map((t) => ({
          exercise: t.exercise,
          cal: t.calories,
          min: t.durationMin,
          source: t.source,
        })),
        garminActsToday: garminActs.map((a) => ({
          sport: a.sport,
          cal: a.calories,
          name: a.name,
        })),
        metricsToday: metrics,
        dailyMetricStore: metricTotals,
        sinceJul1: { recentWithCal, recentNoCal, bySource },
      },
      null,
      2,
    ),
  )
} catch (e) {
  console.log(JSON.stringify({ err: String(e?.message || e).slice(0, 400) }))
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
