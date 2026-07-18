import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Read-only Period Review. Generated locally by `scripts/analyze-periods.mjs`.
// Auth is handled in proxy.ts (session / mobile bearer).

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const asOf = searchParams.get('asOf')?.trim()

    const row = asOf
      ? await prisma.periodReviewReport.findUnique({ where: { asOf } })
      : await prisma.periodReviewReport.findFirst({ orderBy: { asOf: 'desc' } })

    if (!row) {
      return NextResponse.json({ report: null })
    }

    return NextResponse.json({
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
