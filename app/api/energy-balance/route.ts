import { NextResponse } from 'next/server'
import {
  getDayEnergyBalance,
  getEnergyBalanceRange,
  getMonthEnergyRecap,
  getWeekEnergyRecap,
} from '@/lib/energyBalance'
import { today } from '@/lib/timeWindow'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const week = searchParams.get('week')
    const month = searchParams.get('month')
    const mode = searchParams.get('mode')

    if (month === '1' || mode === 'month' || mode === '30') {
      const asOf = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined
      const recap = await getMonthEnergyRecap(asOf)
      return NextResponse.json(recap)
    }

    if (week === '1' || mode === 'week') {
      const asOf = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined
      const recap = await getWeekEnergyRecap(asOf)
      return NextResponse.json(recap)
    }

    if (from && to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return NextResponse.json({ error: 'from/to must be yyyy-mm-dd' }, { status: 400 })
      }
      const days = await getEnergyBalanceRange(from, to)
      return NextResponse.json({ days })
    }

    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today()

    const balance = await getDayEnergyBalance(day)
    return NextResponse.json(balance)
  } catch (err) {
    console.error('[energy-balance]', err)
    return NextResponse.json({ error: 'Failed to compute energy balance' }, { status: 500 })
  }
}
