import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Compute a 0–100 readiness score from sleep data only.
// Formula: 60% hours component (target 8h) + 40% quality component (1–5 scale)
function computeSleepScore(hours: number, quality: number): number {
  const hoursScore   = Math.min(1, hours / 8) * 60
  const qualityScore = ((quality - 1) / 4) * 40
  return Math.round(hoursScore + qualityScore)
}

// Normalise HRV against recent baseline using a simple 14-day average.
// Returns 0–100: 100 = HRV at or above baseline, 0 = severely below.
function computeHrvReadiness(hrv: number, baseline14d: number | null): number | null {
  if (!baseline14d || baseline14d === 0) return null
  const ratio = hrv / baseline14d
  return Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

function readinessLabel(score: number): string {
  if (score >= 80) return 'Full recovery'
  if (score >= 65) return 'Good shape'
  if (score >= 50) return 'Reduced capacity'
  if (score >= 35) return 'Compromised'
  return 'Poor'
}

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
    const [sleepEntries] = await Promise.all([
      prisma.sleepEntry.findMany({ orderBy: { date: 'desc' }, take: 14 }),
    ])

    const latest = sleepEntries[0] ?? null

    if (!latest) {
      return NextResponse.json(
        { connected: true, available: false, reason: 'No sleep data logged yet' },
        { headers: corsHeaders },
      )
    }

    const score = computeSleepScore(latest.hours, latest.quality)

    // HRV readiness: compare today vs 14-day average
    const withHrv = sleepEntries.filter(e => e.hrv != null)
    const baseline14d =
      withHrv.length >= 3
        ? withHrv.slice(0, 14).reduce((s, e) => s + (e.hrv ?? 0), 0) / Math.min(withHrv.length, 14)
        : null
    const hrvReadiness =
      latest.hrv && baseline14d ? computeHrvReadiness(latest.hrv, baseline14d) : null

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
