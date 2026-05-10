import { createElement } from 'react'
import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db'
import WeeklyPdfDocument from '@/components/report/WeeklyPdfDocument'

export const dynamic = 'force-dynamic'

function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday ISO date (yyyy-mm-dd) of the calendar week containing `weekOfDay` */
function weekStartMonday(weekOfDay: string): string {
  const base = new Date(weekOfDay + 'T12:00:00')
  if (Number.isNaN(+base)) return isoLocal(new Date())
  const dow = base.getDay()
  const off = dow === 0 ? -6 : 1 - dow
  const mon = new Date(base)
  mon.setDate(base.getDate() + off)
  return isoLocal(mon)
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return isoLocal(d)
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const weekOfParam = searchParams.get('weekOf')
    const ref =
      typeof weekOfParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekOfParam)
        ? weekOfParam
        : isoLocal(new Date())

    const start = weekStartMonday(ref)
    const end = addDaysIso(start, 6)

    const [weights, foods, sleeps, trains, journals, measures] = await Promise.all([
      prisma.weightEntry.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: 'asc' },
      }),
      prisma.foodEntry.findMany({ where: { date: { gte: start, lte: end } } }),
      prisma.sleepEntry.findMany({ where: { date: { gte: start, lte: end } } }),
      prisma.trainingEntry.findMany({ where: { date: { gte: start, lte: end } } }),
      prisma.journalEntry.findMany({
        where: { date: { gte: start, lte: end }, mood: { not: null } },
      }),
      prisma.bodyMeasurement.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: 'desc' },
      }),
    ])

    const scaleVals = weights.map(w => w.scaleKg)
    const trueVals = weights.map(w => w.trueWeightKg)
    const as = avg(scaleVals)
    const at = avg(trueVals)

    let trend = '—'
    if (weights.length >= 2) {
      const byDate = new Map<string, number[]>()
      for (const w of weights) {
        const list = byDate.get(w.date) ?? []
        list.push(w.trueWeightKg)
        byDate.set(w.date, list)
      }
      const sortedDates = [...byDate.keys()].sort()
      const first = avg(byDate.get(sortedDates[0])!)
      const last = avg(byDate.get(sortedDates[sortedDates.length - 1])!)
      if (first != null && last != null) {
        trend = (last - first).toFixed(2)
      }
    }

    const dayKcal = new Map<string, number>()
    const dayProtein = new Map<string, number>()
    const dayCarbs = new Map<string, number>()
    const dayFat = new Map<string, number>()
    for (const f of foods) {
      dayKcal.set(f.date, (dayKcal.get(f.date) ?? 0) + f.kcal)
      dayProtein.set(f.date, (dayProtein.get(f.date) ?? 0) + f.proteinG)
      dayCarbs.set(f.date, (dayCarbs.get(f.date) ?? 0) + f.carbsG)
      dayFat.set(f.date, (dayFat.get(f.date) ?? 0) + f.fatG)
    }
    const daysInWeek = 7
    const totKcal = [...dayKcal.values()].reduce((a, b) => a + b, 0)
    const totProtein = [...dayProtein.values()].reduce((a, b) => a + b, 0)
    const totCarbs = [...dayCarbs.values()].reduce((a, b) => a + b, 0)
    const totFat = [...dayFat.values()].reduce((a, b) => a + b, 0)
    const nFoodDays = [...dayKcal.keys()].length
    const ak = nFoodDays > 0 ? totKcal / daysInWeek : null
    const ap = nFoodDays > 0 ? totProtein / daysInWeek : null
    const acarb = nFoodDays > 0 ? totCarbs / daysInWeek : null
    const af = nFoodDays > 0 ? totFat / daysInWeek : null

    const sh = sleeps.map(s => s.hours)
    const sq = sleeps.map(s => s.quality)
    const hrvs = sleeps.map(s => s.hrv).filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
    const ah = avg(sh)
    const aq = avg(sq)
    const ahrv = avg(hrvs)

    const trainDates = new Set(trains.map(t => t.date))
    const vol = trains.reduce((s, t) => s + t.volume, 0)
    const aggEx = new Map<string, number>()
    for (const t of trains) {
      aggEx.set(t.exercise, (aggEx.get(t.exercise) ?? 0) + t.volume)
    }
    const top3 = [...aggEx.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, v]) => `${name}: ${Math.round(v)} kg volume`)

    const moods = journals.map(j => j.mood!).filter(m => typeof m === 'number')
    const moodAvg = moods.length ? avg(moods) : null

    let bodyFatPct = '—'
    let waistCm = '—'
    const wm = weights.filter(w => typeof w.bodyFatPct === 'number' && w.bodyFatPct != null)
    if (wm.length) bodyFatPct = String(wm[wm.length - 1].bodyFatPct)
    if (measures[0]?.waistCm != null) waistCm = String(measures[0].waistCm)

    const fmt = (v: number | null, digs = 1) =>
      v == null ? '—' : v.toFixed(digs)

    const props = {
      weekLabel: 'Week starting ' + start,
      start,
      end,
      summary: {
        avgScaleKg: fmt(as, 2),
        avgTrueKg: fmt(at, 2),
        weightTrend: trend,
        avgKcal: fmt(ak, 0),
        avgProtein: fmt(ap, 0),
        avgSleepH: fmt(ah, 2),
        avgSleepQ: fmt(aq ?? null, 1),
        trainSessions: String(trainDates.size),
        trainVolume: String(Math.round(vol)),
      },
      body: {
        bodyFatPct,
        waistCm,
      },
      nutritionDetail: {
        carbs: fmt(acarb, 0),
        fat: fmt(af, 0),
      },
      sleepHrv: fmt(ahrv, 0),
      topExercises: top3.length ? top3 : ['—'],
      moodAvg: moodAvg != null ? moodAvg.toFixed(1) : null,
    }

    const buf = await renderToBuffer(
      createElement(WeeklyPdfDocument, props) as Parameters<typeof renderToBuffer>[0],
    )

    return new NextResponse(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="my-pens-weekly.pdf"',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Report failed' }, { status: 500 })
  }
}
