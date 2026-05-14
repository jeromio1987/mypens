import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getStaticMacroEventsInRange } from '@/lib/investing/macroStaticDates'
import { fetchFinnhubEarningsCalendar } from '@/lib/investing/finnhubEarnings'

export const dynamic = 'force-dynamic'

export type CalendarMergedEvent = {
  id?: string
  date: string
  title: string
  kind: string
  symbol?: string | null
  source: 'static' | 'manual' | 'finnhub'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to as yyyy-mm-dd' }, { status: 400 })
  }

  const merged: CalendarMergedEvent[] = []

  for (const e of getStaticMacroEventsInRange(from, to)) {
    merged.push({ date: e.date, title: e.title, kind: e.kind, source: 'static' })
  }

  const manual = await prisma.investingManualEvent.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  })
  for (const m of manual) {
    merged.push({
      id: m.id,
      date: m.date,
      title: m.title,
      kind: m.kind,
      symbol: m.symbol,
      source: 'manual',
    })
  }

  const watch = await prisma.investingWatchlistTicker.findMany({ orderBy: { sortOrder: 'asc' } })
  const symbols = watch.map(w => w.symbol)
  const token = process.env.FINNHUB_API_KEY
  const earn = await fetchFinnhubEarningsCalendar(symbols, from, to, token)
  for (const r of earn) {
    if (r.date < from || r.date > to) continue
    merged.push({
      date: r.date,
      title: `Earnings ${r.symbol}${r.quarter && r.year ? ` Q${r.quarter} ${r.year}` : ''}`,
      kind: 'earnings',
      symbol: r.symbol,
      source: 'finnhub',
    })
  }

  merged.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))

  return NextResponse.json({
    events: merged,
    watchlist: symbols,
    finnhub: Boolean(token),
  })
}
