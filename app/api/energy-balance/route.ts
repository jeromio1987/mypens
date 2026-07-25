import { NextResponse } from 'next/server'
import { getDayEnergyBalance, getEnergyBalanceRange } from '@/lib/energyBalance'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (from && to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return NextResponse.json({ error: 'from/to must be yyyy-mm-dd' }, { status: 400 })
      }
      const days = await getEnergyBalanceRange(from, to)
      return NextResponse.json({ days })
    }

    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10)

    const balance = await getDayEnergyBalance(day)
    return NextResponse.json(balance)
  } catch (err) {
    console.error('[energy-balance]', err)
    return NextResponse.json({ error: 'Failed to compute energy balance' }, { status: 500 })
  }
}
