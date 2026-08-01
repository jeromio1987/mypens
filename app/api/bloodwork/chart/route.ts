import { NextResponse } from 'next/server'
import { loadBloodworkChart } from '@/lib/bloodworkChart'

export const dynamic = 'force-dynamic'

/** Multi-draw marker chart (ref bands + prior→latest). */
export async function GET() {
  try {
    const chart = await loadBloodworkChart()
    return NextResponse.json(chart)
  } catch (e) {
    console.error('[bloodwork/chart GET]', e)
    return NextResponse.json({ error: 'Failed to load bloodwork chart' }, { status: 500 })
  }
}
