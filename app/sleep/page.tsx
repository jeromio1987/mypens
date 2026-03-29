'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SleepEntry from '@/components/sleep/SleepEntry'
import SleepTrend from '@/components/sleep/SleepTrend'

export default function SleepPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [refresh, setRefresh] = useState(0)

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
              <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Sleep</h1>
              <p className="text-xs text-pens-cream/40 mt-0.5">Hours · Quality · HRV</p>
            </div>
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-pens-navy border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream focus:outline-none focus:border-pens-cream/30"
          />
        </div>

        <SleepEntry date={date} onSaved={() => setRefresh(r => r + 1)} />
        <SleepTrend refresh={refresh} />
      </div>
    </main>
  )
}
