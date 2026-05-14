import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to required as yyyy-mm-dd' }, { status: 400 })
  }

  const rows = await prisma.investingManualEvent.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: [{ date: 'asc' }, { title: 'asc' }],
  })
  return NextResponse.json({ events: rows })
}

export async function POST(request: Request) {
  let body: { date?: string; title?: string; kind?: string; symbol?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const date = body.date?.trim() ?? ''
  const title = body.title?.trim() ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) {
    return NextResponse.json({ error: 'date (yyyy-mm-dd) and title required' }, { status: 400 })
  }

  const row = await prisma.investingManualEvent.create({
    data: {
      date,
      title,
      kind: body.kind?.trim() || 'manual',
      symbol: body.symbol?.trim()?.toUpperCase() || null,
    },
  })
  return NextResponse.json(row)
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query required' }, { status: 400 })
  await prisma.investingManualEvent.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
