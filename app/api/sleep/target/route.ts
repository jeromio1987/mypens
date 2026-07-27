import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { today } from '@/lib/timeWindow'

function clampHours(v: number): number {
  return Math.min(10, Math.max(5, v))
}

const DEFAULT_HOURS = 7.5

export async function GET() {
  try {
    const goal = await prisma.goal.findFirst({
      where: { module: 'sleep', metricKey: 'hoursPerNight' },
    })
    const targetHours = goal?.targetValue != null ? clampHours(Number(goal.targetValue)) : DEFAULT_HOURS

    return NextResponse.json({
      targetHours,
      ...(goal?.id ? { id: goal.id } : {}),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const raw = Number(body.targetHours)
    if (Number.isNaN(raw)) {
      return NextResponse.json({ error: 'targetHours must be a number' }, { status: 400 })
    }
    const targetHours = clampHours(raw)
    const todayStr = today()

    const existing = await prisma.goal.findFirst({
      where: { module: 'sleep', metricKey: 'hoursPerNight' },
    })

    if (existing) {
      const updated = await prisma.goal.update({
        where: { id: existing.id },
        data: { targetValue: targetHours },
      })
      return NextResponse.json({
        targetHours: clampHours(updated.targetValue),
        id: updated.id,
      })
    }

    const created = await prisma.goal.create({
      data: {
        module: 'sleep',
        metricKey: 'hoursPerNight',
        targetValue: targetHours,
        startValue: targetHours,
        startDate: todayStr,
      },
    })
    return NextResponse.json({
      targetHours: clampHours(created.targetValue),
      id: created.id,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
