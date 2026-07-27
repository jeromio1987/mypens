import { NextResponse } from 'next/server'
import { loadBloodworkLatestSummary } from '@/lib/bloodworkLatestSummary'

export const dynamic = 'force-dynamic'

/** Soft latest-panel chip payload for Read / Audit (never medical advice). */
export async function GET() {
  try {
    const summary = await loadBloodworkLatestSummary()
    return NextResponse.json(summary)
  } catch (e) {
    console.error('[bloodwork/latest-summary GET]', e)
    return NextResponse.json({ error: 'Failed to load latest labs summary' }, { status: 500 })
  }
}
