import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

const TARGETS = new Set(['alcohol', 'cocaine', 'escort', 'other'])
const ACTIONS = new Set(['cold_shower', 'walk', 'training', 'gaming', 'breath', 'other'])
const OUTCOMES = new Set(['resisted', 'partial', 'slipped'])

interface CravingPayload {
  target?: string
  trigger?: string | null
  action?: string
  outcome?: string
  notes?: string | null
}

export async function GET() {
  const list = await prisma.cravingEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json(list)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CravingPayload
    const target = TARGETS.has(body.target ?? '') ? body.target! : 'alcohol'
    const action = ACTIONS.has(body.action ?? '') ? body.action! : 'cold_shower'
    const outcome = OUTCOMES.has(body.outcome ?? '') ? body.outcome! : 'resisted'
    const event = await prisma.cravingEvent.create({
      data: {
        target,
        action,
        outcome,
        trigger: body.trigger ?? null,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json(event)
  } catch (err) {
    console.error('[anchor/cravings POST]', err)
    return NextResponse.json({ error: 'failed to save' }, { status: 500 })
  }
}
