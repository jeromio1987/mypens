'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { MEAL_LABELS, MEAL_ORDER, type MealType } from '@/lib/foodModels'

interface FoodEntryRow {
  id: string
  date: string
  meal: string
  name: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG?: number
  notes?: string
}

interface Props {
  refresh?: number
  selectedDate: string
  onSelectDate: (date: string) => void
  onChanged?: () => void
}

function dayHeading(iso: string) {
  const today = new Date().toISOString().slice(0, 10)
  const y = new Date()
  y.setDate(y.getDate() - 1)
  const yesterday = y.toISOString().slice(0, 10)
  if (iso === today) return 'Today'
  if (iso === yesterday) return 'Yesterday'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const inputCls =
  'w-full text-xs bg-pens-navy border border-pens-muted/40 rounded px-2 py-1 text-pens-cream'

export default function FoodRecentFeed({ refresh, selectedDate, onSelectDate, onChanged }: Props) {
  const [rows, setRows] = useState<FoodEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<{
    name: string
    meal: string
    date: string
    kcal: string
    proteinG: string
    carbsG: string
    fatG: string
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = () => {
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch('/api/food')
        if (!res.ok) throw new Error('fetch failed')
        const data: FoodEntryRow[] = await res.json()
        if (Array.isArray(data)) setRows(data)
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    })()
  }

  useEffect(() => {
    reload()
  }, [refresh])

  const byDay = useMemo(() => {
    const map = new Map<string, FoodEntryRow[]>()
    for (const e of rows) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return Array.from(map.entries()).slice(0, 10)
  }, [rows])

  async function saveEdit(id: string) {
    if (!edit) return
    setSaving(true)
    try {
      const res = await fetch('/api/food', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: edit.name,
          meal: edit.meal,
          date: edit.date,
          kcal: parseFloat(edit.kcal) || 0,
          proteinG: parseFloat(edit.proteinG) || 0,
          carbsG: parseFloat(edit.carbsG) || 0,
          fatG: parseFloat(edit.fatG) || 0,
        }),
      })
      if (res.ok) {
        setEditingId(null)
        setEdit(null)
        reload()
        onChanged?.()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-4 text-sm text-pens-cream/40">
        Loading recent…
      </div>
    )
  }

  if (byDay.length === 0) {
    return (
      <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-4 text-sm text-pens-cream/40">
        No food logged yet — add below.
      </div>
    )
  }

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-pens-cream/50">Recent</h2>
        <p className="text-[11px] text-pens-cream/30">Scroll · tap day · pencil to edit</p>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
        {byDay.map(([day, items]) => {
          const kcal = items.reduce((s, e) => s + (e.kcal || 0), 0)
          const active = day === selectedDate
          return (
            <div key={day}>
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={[
                  'w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg mb-1 transition-colors',
                  active
                    ? 'bg-pens-gold/15 text-pens-gold'
                    : 'text-pens-cream/70 hover:bg-pens-navy/50',
                ].join(' ')}
              >
                <span className="text-xs font-semibold">{dayHeading(day)}</span>
                <span className="text-[11px] opacity-70">{Math.round(kcal)} kcal · {items.length}</span>
              </button>
              <ul className="space-y-0.5 pl-1">
                {items.map(e => (
                  <li key={e.id}>
                    {editingId === e.id && edit ? (
                      <div className="bg-pens-navy/60 rounded-lg p-2 space-y-1.5 border border-pens-muted/30">
                        <input className={inputCls} value={edit.name} onChange={ev => setEdit({ ...edit, name: ev.target.value })} />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input type="date" className={inputCls} value={edit.date} onChange={ev => setEdit({ ...edit, date: ev.target.value })} />
                          <select className={inputCls} value={edit.meal} onChange={ev => setEdit({ ...edit, meal: ev.target.value })}>
                            {MEAL_ORDER.map(m => (
                              <option key={m} value={m}>{MEAL_LABELS[m]}</option>
                            ))}
                          </select>
                          <input className={inputCls} type="number" placeholder="kcal" value={edit.kcal} onChange={ev => setEdit({ ...edit, kcal: ev.target.value })} />
                          <input className={inputCls} type="number" placeholder="P" value={edit.proteinG} onChange={ev => setEdit({ ...edit, proteinG: ev.target.value })} />
                          <input className={inputCls} type="number" placeholder="C" value={edit.carbsG} onChange={ev => setEdit({ ...edit, carbsG: ev.target.value })} />
                          <input className={inputCls} type="number" placeholder="F" value={edit.fatG} onChange={ev => setEdit({ ...edit, fatG: ev.target.value })} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => { setEditingId(null); setEdit(null) }} className="text-xs text-pens-cream/50 flex items-center gap-1"><X size={12} /> Cancel</button>
                          <button type="button" disabled={saving} onClick={() => void saveEdit(e.id)} className="text-xs text-emerald-400 flex items-center gap-1"><Check size={12} /> Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-between gap-2 px-2 py-1 rounded hover:bg-pens-navy/30 group">
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wide text-pens-cream/30 mr-1.5">
                            {MEAL_LABELS[(e.meal as MealType)] ?? e.meal}
                          </span>
                          <span className="text-sm text-pens-cream truncate">{e.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-pens-cream/40">
                            {e.kcal > 0 ? `${Math.round(e.kcal)}` : '—'}
                          </span>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => {
                              setEditingId(e.id)
                              setEdit({
                                name: e.name,
                                meal: e.meal,
                                date: e.date,
                                kcal: String(e.kcal),
                                proteinG: String(e.proteinG),
                                carbsG: String(e.carbsG),
                                fatG: String(e.fatG),
                              })
                            }}
                            className="opacity-0 group-hover:opacity-100 text-pens-cream/40 hover:text-pens-gold p-0.5"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
