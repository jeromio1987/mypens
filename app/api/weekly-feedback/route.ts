import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Read-only endpoint for the Weekly Feedback Loop. Reports are produced
// out-of-band by `scripts/weekly-feedback.mjs` (which runs locally, where
// the agent transcripts live) and stored in WeeklyFeedbackReport. Web +
// mobile clients just render the latest (or a specific) week.
//
// Auth is handled centrally in proxy.ts (session cookie for web, Bearer
// MOBILE_PENS_API_TOKEN for the Expo app), so no extra check is needed here.

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
    const weekOf = searchParams.get('weekOf')?.trim()
    const wantList = searchParams.get('list') === '1'

    // Lightweight index of available weeks (for a history picker).
    if (wantList) {
      const rows = await prisma.weeklyFeedbackReport.findMany({
        orderBy: { weekOf: 'desc' },
        take: 26,
        select: { weekOf: true, weekEnd: true, generatedAt: true },
      })
      return NextResponse.json({
        weeks: rows.map(r => ({
          weekOf: r.weekOf,
          weekEnd: r.weekEnd,
          generatedAt: r.generatedAt.toISOString(),
        })),
      })
    }

    const report = weekOf
      ? await prisma.weeklyFeedbackReport.findUnique({ where: { weekOf } })
      : await prisma.weeklyFeedbackReport.findFirst({ orderBy: { weekOf: 'desc' } })

    if (!report) {
      return NextResponse.json({ report: null })
    }

    return NextResponse.json({
      report: {
        weekOf: report.weekOf,
        weekEnd: report.weekEnd,
        combinedSummary: report.combinedSummary,
        healthAnalysis: report.healthAnalysis,
        claudeWorkAnalysis: report.claudeWorkAnalysis,
        wins: safeParse<string[]>(report.wins, []),
        improvements: safeParse<string[]>(report.improvements, []),
        healthActions: safeParse<string[]>(report.healthActions, []),
        metrics: safeParse<Record<string, unknown>>(report.metrics, {}),
        model: report.model,
        generatedAt: report.generatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[weekly-feedback]', error)
    return NextResponse.json({ error: 'Failed to load weekly feedback' }, { status: 500 })
  }
}
