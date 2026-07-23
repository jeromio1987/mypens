import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { planWeek, type GoalKind, type LongDay, type Sport } from '@/lib/planner/planWeek'
import { mondayOf, shiftDateStr, toDateStr } from '@/lib/weekDates'

export const dynamic = 'force-dynamic'

function parseSports(raw: string | null | undefined): Sport[] {
  try {
    const v = JSON.parse(raw || '[]')
    if (!Array.isArray(v)) return ['running', 'gym']
    return v.filter((s): s is Sport =>
      ['running', 'cycling', 'core', 'gym'].includes(String(s)),
    )
  } catch {
    return ['running', 'gym']
  }
}

async function recentContext(before: string) {
  const from = shiftDateStr(before, -14)
  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn()
    } catch {
      return fallback
    }
  }

  const [sleeps, trainings, activities, foods, recoveries, metrics] = await Promise.all([
    safe(
      () =>
        prisma.sleepEntry.findMany({
          where: { date: { gte: from, lte: before } },
          select: { hours: true },
        }),
      [],
    ),
    safe(
      () =>
        prisma.trainingEntry.findMany({
          where: { date: { gte: from, lte: before } },
          select: { date: true, exercise: true, source: true },
        }),
      [],
    ),
    safe(
      () =>
        prisma.garminActivity.findMany({
          where: { date: { gte: from, lte: before } },
          select: { date: true, sport: true },
        }),
      [],
    ),
    safe(
      () =>
        prisma.foodEntry.findMany({
          where: { date: { gte: from, lte: before } },
          select: { proteinG: true, kcal: true },
        }),
      [],
    ),
    safe(
      () =>
        prisma.recoveryEntry.findMany({
          where: { date: { gte: from, lte: before } },
          select: { alcoholDrinks: true },
        }),
      [],
    ),
    safe(
      () =>
        prisma.garminDailyMetric.findMany({
          where: { date: { gte: from, lte: before }, kind: 'resting_hr' },
          select: { valueNum: true },
        }),
      [],
    ),
  ])

  const avg = (nums: number[]) =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null

  const sessionsBySport: Record<string, number> = {}
  for (const t of trainings) {
    const ex = (t.exercise || '').toLowerCase()
    const sport =
      t.source === 'strava' || /squat|deadlift|bench|press|gym|lift/.test(ex)
        ? 'gym'
        : /run/.test(ex)
          ? 'running'
          : /cycle|bike/.test(ex)
            ? 'cycling'
            : /core|plank/.test(ex)
              ? 'core'
              : 'gym'
    sessionsBySport[sport] = (sessionsBySport[sport] || 0) + 1
  }
  for (const a of activities) {
    const s = (a.sport || '').toLowerCase()
    const sport = /run/.test(s)
      ? 'running'
      : /cycl|bike/.test(s)
        ? 'cycling'
        : /strength|fit/.test(s)
          ? 'gym'
          : 'running'
    sessionsBySport[sport] = (sessionsBySport[sport] || 0) + 1
  }

  const binge = recoveries.some(r => (r.alcoholDrinks || 0) >= 10)
  const highRhr = metrics.some(m => m.valueNum != null && m.valueNum >= 55)

  return {
    avgSleepHours: avg(sleeps.map(s => s.hours)),
    sessionsBySport,
    recoveryCompromised: binge || highRhr,
    avgProteinG: avg(foods.map(f => f.proteinG || 0)),
    avgKcal: avg(foods.map(f => f.kcal || 0)),
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const weekParam = searchParams.get('weekOf')
    const weekOf = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? mondayOf(weekParam)
      : mondayOf(new Date())

    const goal =
      (await prisma.plannerGoal.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } })) ||
      null

    const goalInput = goal
      ? {
          kind: goal.kind as GoalKind,
          label: goal.label,
          targetNum: goal.targetNum,
          longDay: goal.longDay as LongDay,
          sports: parseSports(goal.sportsJson),
        }
      : {
          kind: 'custom' as GoalKind,
          label: 'General fitness',
          longDay: 'saturday' as LongDay,
          sports: ['running', 'gym'] as Sport[],
        }

    const ctx = await recentContext(shiftDateStr(weekOf, -1))
    const plan = planWeek(weekOf, goalInput, ctx)
    const saved = await prisma.plannerWeek.findUnique({ where: { weekOf } })

    return NextResponse.json({
      weekOf,
      goal,
      plan,
      saved: saved
        ? { id: saved.id, accepted: saved.accepted, createdAt: saved.createdAt.toISOString() }
        : null,
    })
  } catch (error) {
    console.error('[planner GET]', error)
    return NextResponse.json({ error: 'Failed to build plan' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const action = body?.action || 'save_goal'

    if (action === 'save_goal') {
      const kind = String(body.kind || 'custom') as GoalKind
      const label = String(body.label || 'Custom goal').slice(0, 120)
      const longDay = (body.longDay === 'sunday' ? 'sunday' : 'saturday') as LongDay
      const sports = Array.isArray(body.sports) ? body.sports : ['running', 'gym']
      await prisma.plannerGoal.updateMany({ where: { active: true }, data: { active: false } })
      const row = await prisma.plannerGoal.create({
        data: {
          kind,
          label,
          targetNum: body.targetNum != null ? Number(body.targetNum) : null,
          targetText: body.targetText ? String(body.targetText).slice(0, 200) : null,
          raceDate: body.raceDate || null,
          longDay,
          sportsJson: JSON.stringify(sports),
          notes: body.notes ? String(body.notes).slice(0, 500) : null,
          active: true,
        },
      })
      return NextResponse.json({ goal: row })
    }

    if (action === 'accept_week') {
      const weekOf = mondayOf(body.weekOf || toDateStr(new Date()))
      const plan = body.plan || null
      if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })
      const row = await prisma.plannerWeek.upsert({
        where: { weekOf },
        create: {
          weekOf,
          goalId: body.goalId || null,
          planJson: JSON.stringify(plan),
          accepted: true,
        },
        update: {
          goalId: body.goalId || null,
          planJson: JSON.stringify(plan),
          accepted: true,
        },
      })
      return NextResponse.json({ week: row })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[planner POST]', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
