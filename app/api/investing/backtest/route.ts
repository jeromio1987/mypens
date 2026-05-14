import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Tier 2-H — minimal rule probe: days where logged sleep quality ≥ threshold
 * AND effective macro regime (forward-filled from snapshots) matches `regime`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sleepGte = Number(searchParams.get('sleepGte') ?? '4')
  const regime = (searchParams.get('regime') ?? 'risk_on').trim().toLowerCase()

  if (!Number.isFinite(sleepGte) || sleepGte < 1 || sleepGte > 5) {
    return NextResponse.json({ error: 'sleepGte must be 1–5' }, { status: 400 })
  }
  if (!regime) return NextResponse.json({ error: 'regime required' }, { status: 400 })

  const [sleeps, snaps] = await Promise.all([
    prisma.sleepEntry.findMany({
      select: { date: true, quality: true, hours: true },
      orderBy: { date: 'asc' },
    }),
    prisma.macroRegimeSnapshot.findMany({
      orderBy: { effectiveDate: 'asc' },
    }),
  ])

  if (snaps.length === 0) {
    return NextResponse.json({
      note: 'Log at least one macro regime (Investing → Regime) with effective dates to enable matching.',
      matchCount: 0,
      matches: [],
    })
  }

  function regimeOnDate(d: string): string | null {
    let current: string | null = null
    for (const s of snaps) {
      if (s.effectiveDate <= d) current = s.regime
    }
    return current
  }

  const matches: { date: string; quality: number; hours: number; regime: string | null }[] = []

  for (const s of sleeps) {
    if (s.quality < sleepGte) continue
    const r = regimeOnDate(s.date)
    if (r === regime) {
      matches.push({ date: s.date, quality: s.quality, hours: s.hours, regime: r })
    }
  }

  const totalSleep = sleeps.filter(s => s.quality >= sleepGte).length

  return NextResponse.json({
    params: { sleepGte, regime },
    matchCount: matches.length,
    eligibleSleepDaysGte: totalSleep,
    regimeSnapshots: snaps.length,
    matches: matches.slice(-60),
  })
}
