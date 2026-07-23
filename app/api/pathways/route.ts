import { NextResponse } from 'next/server'
import { computePathwayStrengths } from '@/lib/pathways/load'

export const runtime = 'nodejs'

/** GET /api/pathways — pathway strengths from Anchor + sleep + cravings. */
export async function GET() {
  try {
    const result = await computePathwayStrengths()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[pathways GET]', err)
    return NextResponse.json({ error: 'failed to score pathways' }, { status: 500 })
  }
}
