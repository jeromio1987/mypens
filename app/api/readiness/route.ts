import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  computeSleepScore,
  hrvReadinessInclusiveRolling,
  readinessLabel,
  type SleepRow,
} from '@/lib/readinessMetrics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Allow investing dashboard (localhost:5173 or Tauri) to call this endpoint
  const origin = request.headers.get('origin') ?? ''
  const corsHeaders: Record<string, string> = {}
  if (
    origin.includes('localhost') ||
    origin.includes('tauri://') ||
    origin === 'null' // Tauri/Electron file:// origin
  ) {
    corsHeaders['Access-Control-Allow-Origin']  = origin || '*'
    corsHeaders['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
  }

  try {
    // Get last 2 sleep entries (today or yesterday is the most recent night)
    const sleepEntries = await prisma.sleepEntry.findMany({ orderBy: { date: 'desc' }, take: 14 })

    const latest = sleepEntries[0] ?? null

    if (!latest) {
      return NextResponse.json(
        { connected: true, available: false, reason: 'No sleep data logged yet' },
        { headers: corsHeaders },
      )
    }

    const rows: SleepRow[] = sleepEntries.map(e => ({
      date: e.date,
      hours: e.hours,
      quality: e.quality,
      hrv: e.hrv,
    }))

    const score = computeSleepScore(latest.hours, latest.quality)
    const hrvReadiness = hrvReadinessInclusiveRolling(rows)

    // Overall readiness: blend sleep score (primary) with HRV readiness if available
    const overallReadiness =
      hrvReadiness != null
        ? Math.round(score * 0.6 + hrvReadiness * 0.4)
        : score

    return NextResponse.json(
      {
        connected:        true,
        available:        true,
        date:             latest.date,
        sleepHours:       latest.hours,
        sleepQuality:     latest.quality,
        hrv:              latest.hrv ?? null,
        sleepScore:       score,
        hrvReadiness:     hrvReadiness,
        overallReadiness: overallReadiness,
        label:            readinessLabel(overallReadiness),
        // Gate thresholds — used by the investing dashboard
        gate: {
          clear:    overallReadiness >= 65,   // proceed normally
          caution:  overallReadiness >= 45 && overallReadiness < 65, // warn, don't block
          reduced:  overallReadiness < 45,    // suggest half-size or no new positions
        },
        // Kelly multiplier: reduce suggested position size based on readiness
        kellyMultiplier:
          overallReadiness >= 65 ? 1.0 :
          overallReadiness >= 45 ? 0.5 :
          0.25,
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error('[readiness]', error)
    return NextResponse.json(
      { connected: false, available: false, reason: 'Server error' },
      { status: 500, headers: corsHeaders },
    )
  }
}

// Handle CORS preflight
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
