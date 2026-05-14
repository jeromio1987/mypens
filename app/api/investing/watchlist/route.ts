import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function normalizeSymbol(s: string): string | null {
  const u = s.trim().toUpperCase()
  if (!/^[A-Z]{1,8}$/.test(u)) return null
  return u
}

export async function GET() {
  const rows = await prisma.investingWatchlistTicker.findMany({
    orderBy: [{ sortOrder: 'asc' }, { symbol: 'asc' }],
  })
  return NextResponse.json({ symbols: rows.map(r => r.symbol) })
}

/** Replace entire watchlist: POST { symbols: ["CCJ","NXE"] } */
export async function POST(request: Request) {
  let body: { symbols?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = Array.isArray(body.symbols) ? body.symbols : []
  const symbols = [...new Set(raw.map(s => normalizeSymbol(String(s))).filter(Boolean))] as string[]

  await prisma.$transaction([
    prisma.investingWatchlistTicker.deleteMany(),
    prisma.investingWatchlistTicker.createMany({
      data: symbols.map((symbol, i) => ({ symbol, sortOrder: i })),
    }),
  ])

  return NextResponse.json({ symbols })
}
