import { NextResponse } from 'next/server'
import { computeVerdictData, type VerdictData, type VerdictPillar, type LedgerItem } from '@/lib/verdictData'

export type { VerdictData, VerdictPillar, LedgerItem }

export async function GET() {
  try {
    const data = await computeVerdictData()
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to compute verdict' }, { status: 500 })
  }
}
