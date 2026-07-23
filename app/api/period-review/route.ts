import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildCockpitWindow } from '@/lib/engines/cockpitData'

export const dynamic = 'force-dynamic'

// Period Review + Engine Cockpit.
// - Default: latest stored PeriodReviewReport (offline generator)
// - ?from=&to=: live cockpit window (series + The Read + causal)
// Auth via proxy.ts

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function isIsoDate(s: string | null | undefined): s is string {
  return Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s))
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const asOf = searchParams.get('asOf')?.trim()
    const from = searchParams.get('from')?.trim()
    const to = searchParams.get('to')?.trim()

    if (isIsoDate(from) && isIsoDate(to)) {
      if (from > to) {
        return NextResponse.json({ error: 'from must be ≤ to' }, { status: 400 })
      }
      const cockpit = await buildCockpitWindow({ from, to, asOf: to })
      return NextResponse.json({ mode: 'live', cockpit })
    }

    const row = asOf
      ? await prisma.periodReviewReport.findUnique({ where: { asOf } })
      : await prisma.periodReviewReport.findFirst({ orderBy: { asOf: 'desc' } })

    if (!row) {
      return NextResponse.json({ mode: 'stored', report: null, cockpit: null })
    }

    return NextResponse.json({
      mode: 'stored',
      report: {
        asOf: row.asOf,
        headline: row.headline,
        generatedAt: row.generatedAt.toISOString(),
        ...safeParse<Record<string, unknown>>(row.reportJson, {}),
      },
    })
  } catch (error) {
    console.error('[period-review]', error)
    return NextResponse.json({ error: 'Failed to load period review' }, { status: 500 })
  }
}
