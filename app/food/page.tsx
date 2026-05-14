'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FoodEntry from '@/components/food/FoodEntry'
import FoodLog from '@/components/food/FoodLog'
import MacroTargets from '@/components/food/MacroTargets'
import { DEFAULT_TARGETS, type DailyTargets } from '@/lib/foodModels'

export default function FoodPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [refresh, setRefresh] = useState(0)
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_TARGETS)

  const bump = useCallback(() => setRefresh(r => r + 1), [])

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors shrink-0">
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
              <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Food</h1>
              <p className="text-xs text-pens-cream/40 mt-0.5">Manual log · AI from a photo</p>
            </div>
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-pens-navy border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream focus:outline-none focus:border-pens-cream/30 shrink-0"
          />
        </div>

        <MacroTargets onTargetsChange={setTargets} />
        <FoodEntry date={date} onSaved={bump} />
        <FoodLog date={date} refresh={refresh} targets={targets} onSaved={bump} />
      </div>
    </main>
  )
}
