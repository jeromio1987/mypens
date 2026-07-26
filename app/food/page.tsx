'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import FoodEntry from '@/components/food/FoodEntry'
import FoodLog from '@/components/food/FoodLog'
import FoodRecentFeed from '@/components/food/FoodRecentFeed'
import FoodIncompleteToggle from '@/components/food/FoodIncompleteToggle'
import MacroTargets from '@/components/food/MacroTargets'
import EnergyBalanceCard from '@/components/food/EnergyBalanceCard'
import WeekEnergyRecapCard from '@/components/food/WeekEnergyRecapCard'
import NutrientCard from '@/components/food/NutrientCard'
import { DEFAULT_TARGETS, type DailyTargets } from '@/lib/foodModels'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function FoodPage() {
  const [date, setDate] = useState(todayStr)
  const [refresh, setRefresh] = useState(0)
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_TARGETS)

  const bump = useCallback(() => setRefresh(r => r + 1), [])
  const isToday = date === todayStr()

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
              <p className="text-xs text-pens-cream/40 mt-0.5">
                Type brand → Open Food Facts · photo · adjust grams
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setDate(d => shiftDate(d, -1))}
              className="p-2 rounded-lg bg-pens-navy border border-pens-muted/40 text-pens-cream hover:border-pens-cream/40 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-pens-navy border border-pens-muted/40 rounded-lg px-2.5 py-2 text-sm text-pens-cream focus:outline-none focus:border-pens-cream/30"
            />
            <button
              type="button"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => setDate(d => shiftDate(d, 1))}
              className="p-2 rounded-lg bg-pens-navy border border-pens-muted/40 text-pens-cream hover:border-pens-cream/40 transition-colors disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => setDate(todayStr())}
                className="px-2.5 py-2 rounded-lg text-xs font-medium bg-pens-gold/15 text-pens-gold border border-pens-gold/30 hover:bg-pens-gold/25 transition-colors"
              >
                Today
              </button>
            )}
          </div>
        </div>

        <FoodRecentFeed refresh={refresh} selectedDate={date} onSelectDate={setDate} onChanged={bump} />

        <FoodIncompleteToggle date={date} refresh={refresh} onChanged={bump} />

        <MacroTargets onTargetsChange={setTargets} />
        <EnergyBalanceCard date={date} refresh={refresh} />
        <WeekEnergyRecapCard asOf={date} refresh={refresh} windowDays={7} />
        <WeekEnergyRecapCard asOf={date} refresh={refresh} windowDays={30} />
        <FoodEntry date={date} onSaved={bump} />
        <NutrientCard date={date} refresh={refresh} targets={targets} />
        <FoodLog date={date} refresh={refresh} targets={targets} onSaved={bump} />
      </div>
    </main>
  )
}
