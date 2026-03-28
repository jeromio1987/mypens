import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const goals = await prisma.goal.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(goals)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { module, metricKey, targetValue, startValue, startDate } = body

    if (!module || !metricKey || targetValue == null || startValue == null || !startDate) {
      return NextResponse.json({ error: 'module, metricKey, targetValue, startValue, startDate are required' }, { status: 400 })
    }

    const existing = await prisma.goal.findFirst({ where: { metricKey } })
    if (existing) {
      const goal = await prisma.goal.update({
        where: { id: existing.id },
        data: { module, targetValue: Number(targetValue), startValue: Number(startValue), startDate },
      })
      return NextResponse.json(goal)
    }

    const goal = await prisma.goal.create({
      data: {
        module,
        metricKey,
        targetValue: Number(targetValue),
        startValue: Number(startValue),
        startDate,
      },
    })
    return NextResponse.json(goal)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save goal' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await prisma.goal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
