import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const entry = await prisma.dayEntry.findUnique({ where: { date: today() } })
    if (!entry) return NextResponse.json({ mode: null, tags: [] })
    return NextResponse.json({ mode: entry.mode, tags: JSON.parse(entry.tags) })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load mode' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { mode, tags = [] } = await req.json()
    if (!['locked_in', 'balanced', 'off'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }
    const entry = await prisma.dayEntry.upsert({
      where: { date: today() },
      update: { mode, tags: JSON.stringify(tags) },
      create: { date: today(), mode, tags: JSON.stringify(tags) },
    })
    return NextResponse.json({ mode: entry.mode, tags: JSON.parse(entry.tags) })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save mode' }, { status: 500 })
  }
}
