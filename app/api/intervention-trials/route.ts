import { NextResponse } from 'next/server'
import { listTrials, resolveTrial, startTrial, type TrialOutcome } from '@/lib/signals/trialStore'

export const dynamic = 'force-dynamic'

/** WP 4.3–4.4 — register / resolve intervention trials. */
export async function GET() {
  return NextResponse.json({ trials: listTrials() })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      signalId?: string
      action?: string
      horizonDays?: number
      notes?: string
      id?: string
      outcome?: TrialOutcome
    }
    if (body.id && body.outcome) {
      const row = resolveTrial(body.id, body.outcome, body.notes)
      if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
      return NextResponse.json({ trial: row })
    }
    if (!body.signalId || !body.action || !body.horizonDays) {
      return NextResponse.json({ error: 'signalId, action, horizonDays required' }, { status: 400 })
    }
    const trial = startTrial({
      signalId: body.signalId,
      action: body.action,
      horizonDays: body.horizonDays,
      notes: body.notes,
    })
    return NextResponse.json({ trial })
  } catch (err) {
    console.error('[intervention-trials]', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
