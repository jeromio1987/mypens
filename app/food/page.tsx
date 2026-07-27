'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import FoodEntry from '@/components/food/FoodEntry'
import FoodLog from '@/components/food/FoodLog'
import FoodRecentFeed from '@/components/food/FoodRecentFeed'
import FoodIncompleteToggle from '@/components/food/FoodIncompleteToggle'
import MacroTargets from '@/components/food/MacroTargets'
import BodyPhaseCard from '@/components/food/BodyPhaseCard'
import EnergyBalanceCard from '@/components/food/EnergyBalanceCard'
import WeekEnergyRecapCard from '@/components/food/WeekEnergyRecapCard'
import NutrientCard from '@/components/food/NutrientCard'
import { DEFAULT_TARGETS, type DailyTargets } from '@/lib/foodModels'
import { shiftDateStr, today } from '@/lib/timeWindow'
import { Kicker } from '@/components/continental/kit'

/** Fueling destination body — Continental surfaces (chrome in layout). */
export default function FoodPage() {
  const [date, setDate] = useState(today)
  const [refresh, setRefresh] = useState(0)
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_TARGETS)

  const bump = useCallback(() => setRefresh(r => r + 1), [])
  const isToday = date === today()

  return (
    <div className="px-5 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <Kicker>Fueling</Kicker>
            <h1 className="mt-2 font-headline text-3xl uppercase leading-none tracking-[0.06em] text-ct-primary">
              Ledger
            </h1>
            <p className="mt-2 max-w-[40ch] font-grotesk text-[0.7rem] leading-snug text-ct-second/55">
              Type brand → Open Food Facts · photo · adjust grams
            </p>
          </div>
          <div className="flex items-stretch shrink-0">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setDate(d => shiftDateStr(d, -1))}
              className="p-2.5 bg-ct-high text-ct-primary hover:bg-ct-highest transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-ct-highest px-2.5 py-2 text-sm text-ct-primary font-grotesk focus:outline-none [color-scheme:dark]"
            />
            <button
              type="button"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => setDate(d => shiftDateStr(d, 1))}
              className="p-2.5 bg-ct-high text-ct-primary hover:bg-ct-highest transition-colors disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => setDate(today())}
                className="px-3 py-2 font-grotesk text-[0.625rem] uppercase tracking-[0.16em] bg-ct-bloodc text-ct-blood"
              >
                Today
              </button>
            )}
          </div>
        </div>

        <FoodRecentFeed refresh={refresh} selectedDate={date} onSelectDate={setDate} onChanged={bump} />

        <FoodIncompleteToggle date={date} refresh={refresh} onChanged={bump} />

        <BodyPhaseCard onTargets={setTargets} />
        <MacroTargets onTargetsChange={setTargets} />
        <EnergyBalanceCard date={date} refresh={refresh} />
        <WeekEnergyRecapCard asOf={date} refresh={refresh} windowDays={7} defaultCollapsed />
        <WeekEnergyRecapCard asOf={date} refresh={refresh} windowDays={30} defaultCollapsed />
        <FoodEntry date={date} onSaved={bump} />
        <NutrientCard date={date} refresh={refresh} targets={targets} />
        <FoodLog date={date} refresh={refresh} targets={targets} onSaved={bump} />
      </div>
    </div>
  )
}
