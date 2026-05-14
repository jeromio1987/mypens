import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sentimentForSymbol } from '@/lib/investing/sentimentRss'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('symbols') ?? ''
  const fromWatch = new URL(request.url).searchParams.get('fromWatchlist') === '1'

  let symbols = raw
    .split(/[\s,]+/)
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z]{1,8}$/.test(s))

  if (fromWatch || symbols.length === 0) {
    const w = await prisma.investingWatchlistTicker.findMany({ orderBy: { sortOrder: 'asc' } })
    symbols = w.map(x => x.symbol)
  }

  symbols = [...new Set(symbols)].slice(0, 12)

  const results = []
  for (const sym of symbols) {
    results.push(await sentimentForSymbol(sym))
  }

  return NextResponse.json({ results })
}
