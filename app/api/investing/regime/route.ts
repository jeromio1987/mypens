import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { pushNtfy } from '@/lib/investing/notifyNtfy'

export const dynamic = 'force-dynamic'

const REGIME_ALIASES = new Set(['risk_on', 'risk_off', 'neutral', 'mixed'])

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function GET() {
  const rows = await prisma.macroRegimeSnapshot.findMany({
    orderBy: { effectiveDate: 'desc' },
    take: 40,
  })
  const latest = rows[0] ?? null
  return NextResponse.json({ latest, history: rows })
}

export async function POST(request: Request) {
  let body: { regime?: string; notes?: string | null; effectiveDate?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const regime = body.regime?.trim().toLowerCase().replace(/\s+/g, '_') ?? ''
  if (!regime || regime.length > 32) {
    return NextResponse.json({ error: 'regime required (max 32 chars)' }, { status: 400 })
  }

  const effectiveDate =
    body.effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(body.effectiveDate)
      ? body.effectiveDate
      : todayUtcDate()

  const prior = await prisma.macroRegimeSnapshot.findFirst({
    where: { effectiveDate: { lt: effectiveDate } },
    orderBy: { effectiveDate: 'desc' },
  })

  const previousSameDay = await prisma.macroRegimeSnapshot.findFirst({
    where: { effectiveDate },
    orderBy: { createdAt: 'desc' },
  })

  await prisma.macroRegimeSnapshot.deleteMany({ where: { effectiveDate } })

  const row = await prisma.macroRegimeSnapshot.create({
    data: {
      effectiveDate,
      regime,
      notes: body.notes?.trim() || null,
    },
  })

  const baseline = previousSameDay ?? prior
  const changed = baseline && baseline.regime !== regime

  if (changed) {
    const title = 'Macro regime update'
    const msg = `Regime → ${regime} (effective ${effectiveDate})${body.notes ? `\n${body.notes}` : ''}`
    await prisma.notification.create({
      data: {
        kind: 'investing_regime',
        title,
        body: msg,
        href: '/investing',
      },
    })
    await pushNtfy(title, msg)
  }

  return NextResponse.json({
    row,
    regimeHint: REGIME_ALIASES.has(regime) ? null : 'Tip: use risk_on | risk_off | neutral | mixed for backtests.',
  })
}
