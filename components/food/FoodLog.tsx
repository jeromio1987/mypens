'use client'

import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import {
  sumMacros,
  pctOfTarget,
  DEFAULT_TARGETS,
  MEAL_ORDER,
  MEAL_LABELS,
  type MealType,
  type DailyTargets,
} from '@/lib/foodModels'

interface FoodEntryRow {
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

interface EditForm {
  meal: string
  name: string
  kcal: string
  proteinG: string
  carbsG: string
  fatG: string
  fiberG: string
  notes: string
}

interface Props {
  date: string
  refresh?: number
  targets?: DailyTargets
  onSaved?: () => void
}

function MacroBar({
  label, value, target, unit, color,
}: {
  label: string; value: number; target: number; unit: string; color: string
}) {
  const pct = pctOfTarget(value, target)
  const over = value > target
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-pens-cream/70">{label}</span>
        <span className={over ? 'text-red-400 font-semibold' : 'text-pens-cream/50'}>
          {Math.round(value)}{unit} / {target}{unit}
        </span>
      </div>
      <div className="h-2 bg-pens-navy/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const inputCls =
  'w-full text-sm bg-pens-navy border border-pens-muted/40 rounded-lg px-2 py-1.5 text-pens-cream focus:outline-none focus:border-pens-gold/50'

export default function FoodLog({ date, refresh, targets = DEFAULT_TARGETS, onSaved }: Props) {
  const [entries, setEntries] = useState<FoodEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState<MealType | null>(null)

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

  const startEdit = (e: FoodEntryRow) => {
    setEditingId(e.id)
    setEditForm({
      meal: e.meal,
      name: e.name,
      kcal: String(e.kcal),
      proteinG: String(e.proteinG),
      carbsG: String(e.carbsG),
      fatG: String(e.fatG),
      fiberG: String(e.fiberG),
      notes: e.notes ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(null)
  }

  const saveEdit = async (id: string) => {
    if (!editForm) return
    setSaving(true)
    try {
      const res = await fetch('/api/food', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          meal: editForm.meal,
          name: editForm.name,
          kcal: parseFloat(editForm.kcal) || 0,
          proteinG: parseFloat(editForm.proteinG) || 0,
          carbsG: parseFloat(editForm.carbsG) || 0,
          fatG: parseFloat(editForm.fatG) || 0,
          fiberG: parseFloat(editForm.fiberG) || 0,
          notes: editForm.notes,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEntries(prev => prev.map(e => e.id === id ? updated : e))
        cancelEdit()
      }
    } finally {
      setSaving(false)
    }
  }

  const copyFromYesterday = async (meal: MealType) => {
    setCopying(meal)
    try {
      const yesterday = new Date(date + 'T00:00:00')
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().slice(0, 10)
      const res = await fetch(`/api/food?date=${yesterdayStr}`)
      const all: FoodEntryRow[] = await res.json()
      const mealEntries = all.filter(e => e.meal === meal)
      if (mealEntries.length === 0) return
      for (const e of mealEntries) {
        await fetch('/api/food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, meal: e.meal, name: e.name, kcal: e.kcal, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG, fiberG: e.fiberG, notes: e.notes }),
        })
      }
      load()
      onSaved?.()
    } finally {
      setCopying(null)
    }
  }

  const totals = sumMacros(entries)
  const byMeal = MEAL_ORDER.reduce(
    (acc, m) => ({ ...acc, [m]: entries.filter(e => e.meal === m) }),
    {} as Record<MealType, FoodEntryRow[]>,
  )

  if (loading) {
    return (
      <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 text-sm text-pens-cream/40">
        Loading…
      </div>
    )
  }

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-pens-cream">
          {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </h2>
        {entries.length > 0 && (
          <span className="text-sm text-pens-cream/40">{Math.round(totals.kcal)} kcal total</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-pens-cream/30 self-center mr-1">Copy from yesterday</span>
        {MEAL_ORDER.map(meal => (
          <button
            key={meal}
            type="button"
            disabled={copying === meal}
            onClick={() => void copyFromYesterday(meal)}
            className="px-2.5 py-1 rounded-lg text-xs text-pens-cream/50 border border-pens-muted/30 hover:border-pens-muted/60 hover:text-pens-cream/80 disabled:opacity-40 transition-colors"
          >
            {copying === meal ? '…' : MEAL_LABELS[meal]}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-pens-cream/40">Nothing logged yet.</p>
      ) : (
        <>
          <div className="space-y-3 p-4 bg-pens-navy/40 rounded-xl border border-pens-muted/20">
            <MacroBar label="Calories" value={totals.kcal} target={targets.kcal} unit=" kcal" color="bg-violet-400" />
            <MacroBar label="Protein" value={totals.proteinG} target={targets.proteinG} unit="g" color="bg-blue-400" />
            <MacroBar label="Carbs" value={totals.carbsG} target={targets.carbsG} unit="g" color="bg-amber-400" />
            <MacroBar label="Fat" value={totals.fatG} target={targets.fatG} unit="g" color="bg-rose-400" />
          </div>

          {MEAL_ORDER.filter(m => byMeal[m].length > 0).map(meal => (
            <div key={meal}>
              <h3 className="text-sm font-semibold text-pens-cream/50 mb-2">{MEAL_LABELS[meal]}</h3>
              <div className="space-y-1">
                {byMeal[meal].map(e => (
                  <div key={e.id}>
                    {editingId === e.id && editForm ? (
                      <div className="bg-pens-navy/60 rounded-xl p-3 space-y-2 border border-pens-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <input
                              className={inputCls}
                              placeholder="Item name"
                              value={editForm.name}
                              onChange={ev => setEditForm(f => f ? { ...f, name: ev.target.value } : f)}
                            />
                          </div>
                          <select
                            className={inputCls}
                            value={editForm.meal}
                            onChange={ev => setEditForm(f => f ? { ...f, meal: ev.target.value } : f)}
                          >
                            {MEAL_ORDER.map(m => (
                              <option key={m} value={m}>{MEAL_LABELS[m]}</option>
                            ))}
                          </select>
                          <input className={inputCls} placeholder="kcal" type="number" value={editForm.kcal} onChange={ev => setEditForm(f => f ? { ...f, kcal: ev.target.value } : f)} />
                          <input className={inputCls} placeholder="Protein (g)" type="number" value={editForm.proteinG} onChange={ev => setEditForm(f => f ? { ...f, proteinG: ev.target.value } : f)} />
                          <input className={inputCls} placeholder="Carbs (g)" type="number" value={editForm.carbsG} onChange={ev => setEditForm(f => f ? { ...f, carbsG: ev.target.value } : f)} />
                          <input className={inputCls} placeholder="Fat (g)" type="number" value={editForm.fatG} onChange={ev => setEditForm(f => f ? { ...f, fatG: ev.target.value } : f)} />
                          <input className={inputCls} placeholder="Fibre (g)" type="number" value={editForm.fiberG} onChange={ev => setEditForm(f => f ? { ...f, fiberG: ev.target.value } : f)} />
                          <div className="col-span-2">
                            <input
                              className={inputCls}
                              placeholder="Notes (optional)"
                              value={editForm.notes}
                              onChange={ev => setEditForm(f => f ? { ...f, notes: ev.target.value } : f)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={cancelEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-pens-muted/40 text-pens-cream/60 hover:bg-pens-navy/40">
                            <X size={12} /> Cancel
                          </button>
                          <button type="button" onClick={() => saveEdit(e.id)} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                            <Check size={12} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-pens-navy/30 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-pens-cream truncate">{e.name}</p>
                          <p className="text-xs text-pens-cream/40">
                            {e.kcal > 0 && `${Math.round(e.kcal)} kcal`}
                            {e.proteinG > 0 && ` · ${e.proteinG}g P`}
                            {e.carbsG > 0 && ` · ${e.carbsG}g C`}
                            {e.fatG > 0 && ` · ${e.fatG}g F`}
                            {e.notes && ` · ${e.notes}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-all">
                          <button type="button" onClick={() => startEdit(e)} className="p-1 text-pens-cream/30 hover:text-emerald-400" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button type="button" onClick={() => handleDelete(e.id)} disabled={deleting === e.id} className="p-1 text-pens-cream/30 hover:text-red-400 disabled:opacity-20" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
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
