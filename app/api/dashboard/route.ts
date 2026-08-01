import { NextResponse } from 'next/server'
import { computeDashboardData } from '@/lib/dashboardData'

export type { StructuredInsight } from '@/lib/dashboardData'

export async function GET() {
  try {
    const data = await computeDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
