'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  sumMacros,
  pctOfTarget,
  DEFAULT_TARGETS,
  MEAL_ORDER,
  MEAL_LABELS,
  type MealType,
  type DailyTargets,
} from '@/lib/foodModels'

interface FoodEntry {
  id: string
  date: string
  meal: string
  name: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  notes?: string
}

interface Props {
  date: string
  refresh?: number
  targets?: DailyTargets
}

function MacroBar({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string
  value: number
  target: number
  unit: string
  color: string
}) {
  const pct = pctOfTarget(value, target)
  const over = value > target
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-gray-600">{label}</span>
        <span className={over ? 'text-red-500 font-semibold' : 'text-gray-500'}>
          {Math.round(value)}{unit} / {target}{unit}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function FoodLog({ date, refresh, targets = DEFAULT_TARGETS }: Props) {
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/food?date=${date}`)
      .then(r => r.json())
      .then(setEntries)
      .finally(() => setLoading(false))
  }

  useEffect(load, [date, refresh])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch('/api/food', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setEntries(e => e.filter(x => x.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const totals = sumMacros(entries)
  const byMeal = MEAL_ORDER.reduce(
    (acc, m) => ({ ...acc, [m]: entries.filter(e => e.meal === m) }),
    {} as Record<MealType, FoodEntry[]>
  )

  if (loading)
    return (
      <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">Loading…</div>
    )

  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </h2>
        {entries.length > 0 && (
          <span className="text-sm text-gray-400">{Math.round(totals.kcal)} kcal total</span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing logged yet.</p>
      ) : (
        <>
          {/* Macro progress bars */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
            <MacroBar
              label="Calories"
              value={totals.kcal}
              target={targets.kcal}
              unit=" kcal"
              color="bg-violet-400"
            />
            <MacroBar
              label="Protein"
              value={totals.proteinG}
              target={targets.proteinG}
              unit="g"
              color="bg-blue-400"
            />
            <MacroBar
              label="Carbs"
              value={totals.carbsG}
              target={targets.carbsG}
              unit="g"
              color="bg-amber-400"
            />
            <MacroBar
              label="Fat"
              value={totals.fatG}
              target={targets.fatG}
              unit="g"
              color="bg-rose-400"
            />
          </div>

          {/* Entries grouped by meal */}
          {MEAL_ORDER.filter(m => byMeal[m].length > 0).map(meal => (
            <div key={meal}>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">
                {MEAL_LABELS[meal]}
              </h3>
              <div className="space-y-1">
                {byMeal[meal].map(e => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.name}</p>
                      <p className="text-xs text-gray-400">
                        {e.kcal > 0 && `${Math.round(e.kcal)} kcal`}
                        {e.proteinG > 0 && ` · ${e.proteinG}g P`}
                        {e.carbsG > 0 && ` · ${e.carbsG}g C`}
                        {e.fatG > 0 && ` · ${e.fatG}g F`}
                        {e.notes && ` · ${e.notes}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deleting === e.id}
                      className="ml-3 p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-20"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
