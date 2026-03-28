import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const events = await prisma.eventTag.findMany({
      orderBy: { startDate: 'desc' },
    })
    return NextResponse.json(events)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, label, startDate, endDate, notes } = body

    if (!type || !label || !startDate || !endDate) {
      return NextResponse.json({ error: 'type, label, startDate, endDate are required' }, { status: 400 })
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 })
    }

    const event = await prisma.eventTag.create({
      data: { type, label, startDate, endDate, notes: notes ?? null },
    })
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.eventTag.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
