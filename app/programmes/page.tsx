'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Check,
  PlusCircle,
  GripVertical,
} from 'lucide-react'

type ProgrammeExerciseRow = {
  id: string
  name: string
  sets: number
  reps: string
  weightKg: number | null
  order: number
}

type ProgrammeDayRow = {
  id: string
  dayLabel: string
  order: number
  exercises: ProgrammeExerciseRow[]
}

type ProgrammeRow = {
  id: string
  name: string
  active: boolean
  createdAt: string
  days: ProgrammeDayRow[]
}

const DAY_DRAG_MIME = 'application/x-mypens-programme-day'
const EX_DRAG_MIME = 'application/x-mypens-programme-ex'

function reorderByIndex<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to) return [...items]
  const copy = [...items]
  const [removed] = copy.splice(from, 1)
  copy.splice(to, 0, removed)
  return copy
}

export default function ProgrammesPage() {
  const [list, setList] = useState<ProgrammeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/programmes')
      .then(r => r.json())
      .then(rows => {
        if (Array.isArray(rows)) {
          setList(rows as ProgrammeRow[])
          setSelectedId(s => {
            if (s && rows.some((p: ProgrammeRow) => p.id === s)) return s
            return rows.length ? rows[0].id : null
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (!cancelled) load()
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const selected = useMemo(
    () => list.find(p => p.id === selectedId) ?? null,
    [list, selectedId],
  )

  async function createProgramme(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const res = await fetch('/api/programmes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const p = await res.json()
      setNewName('')
      setCreating(false)
      setSelectedId(p.id)
      await load()
    }
  }

  async function patchProgramme(id: string, patch: { name?: string; active?: boolean }) {
    const res = await fetch(`/api/programmes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) await load()
  }

  async function deleteProgramme(id: string) {
    if (!confirm('Delete this programme?')) return
    const res = await fetch(`/api/programmes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      if (selectedId === id) setSelectedId(null)
      await load()
    }
  }

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8 text-pens-cream">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/training" className="text-xs text-orange-400 hover:text-orange-300">
              ← Training
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-pens-cream">Programmes</h1>
            <p className="text-sm text-pens-cream/50">Build days and exercises, then start from Training.</p>
          </div>
          <Link
            href="/programmes/compare"
            className="text-xs font-semibold text-pens-gold border border-pens-gold/40 rounded-lg px-3 py-2 hover:bg-pens-gold/10"
          >
            Compare two →
          </Link>
        </div>

        <section className="rounded-2xl border border-pens-muted/30 bg-pens-navy/80 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-400">Your programmes</h2>
            <button
              type="button"
              onClick={() => setCreating(c => !c)}
              className="inline-flex items-center gap-1 rounded-lg border border-orange-500/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-orange-400 hover:bg-orange-500/10"
            >
              <PlusCircle size={14} />
              New programme
            </button>
          </div>

          {creating && (
            <form onSubmit={createProgramme} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="flex-1 rounded-lg border border-pens-muted/40 bg-pens-deep px-3 py-2 text-sm text-pens-cream"
                placeholder="Programme name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-500">
                  Create
                </button>
                <button type="button" onClick={() => setCreating(false)} className="text-xs text-pens-cream/50 underline">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-sm text-pens-cream/40">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-pens-cream/45">No programmes yet.</p>
          ) : (
            <ul className="space-y-2">
              {list.map(p => (
                <li
                  key={p.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${selectedId === p.id ? 'border-orange-500/50 bg-orange-500/10' : 'border-pens-muted/25 bg-pens-deep/60'}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="flex-1 truncate text-left text-sm font-semibold hover:text-orange-400"
                  >
                    {p.name}
                  </button>
                  <label className="flex items-center gap-2 text-xs text-pens-cream/55">
                    <input
                      type="checkbox"
                      className="rounded accent-orange-500"
                      checked={p.active}
                      onChange={() =>
                        patchProgramme(p.id, { active: !p.active })
                      }
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteProgramme(p.id)}
                    className="text-pens-cream/35 hover:text-pens-crimson"
                    aria-label="Delete programme"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected && <ProgrammeDetail key={selected.id} programme={selected} onReload={load} />}
      </div>
    </main>
  )
}

function ProgrammeDetail({
  programme,
  onReload,
}: {
  programme: ProgrammeRow
  onReload: () => Promise<void> | void
}) {
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const [dayLabelDraft, setDayLabelDraft] = useState('')
  const [exForms, setExForms] = useState<
    Record<
      string,
      { name: string; sets: string; reps: string; weightKg: string }
    >
  >({})

  const toggleDay = (id: string) =>
    setOpenDays(d => ({ ...d, [id]: !d[id] }))

  async function addDay(e: React.FormEvent) {
    e.preventDefault()
    const dayLabel = dayLabelDraft.trim()
    if (!dayLabel) return
    await fetch(`/api/programmes/${programme.id}/days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayLabel }),
    })
    setDayLabelDraft('')
    await onReload()
  }

  async function deleteDay(dayId: string) {
    if (!confirm('Delete this day and its exercises?')) return
    await fetch(`/api/programmes/${programme.id}/days/${dayId}`, { method: 'DELETE' })
    await onReload()
  }

  async function addExercise(dayId: string) {
    const f = exForms[dayId] ?? { name: '', sets: '3', reps: '8', weightKg: '' }
    const sets = parseInt(f.sets, 10)
    if (!f.name.trim() || !Number.isFinite(sets) || sets < 1 || !f.reps.trim()) return
    await fetch(`/api/programmes/${programme.id}/days/${dayId}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.name.trim(),
        sets,
        reps: f.reps.trim(),
        weightKg: f.weightKg ? parseFloat(f.weightKg) : null,
      }),
    })
    setExForms(ef => ({
      ...ef,
      [dayId]: { name: '', sets: f.sets, reps: f.reps, weightKg: f.weightKg },
    }))
    await onReload()
  }

  async function deleteExercise(dayId: string, exerciseId: string) {
    await fetch(`/api/programmes/${programme.id}/days/${dayId}/exercises?exerciseId=${exerciseId}`, {
      method: 'DELETE',
    })
    await onReload()
  }

  const inputCls =
    'rounded-lg border border-pens-muted/40 bg-pens-deep px-2 py-1.5 text-xs text-pens-cream placeholder:text-pens-cream/30'

  return (
    <section className="rounded-2xl border border-pens-muted/30 bg-pens-navy/80 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-pens-cream">Selected: {programme.name}</h2>

      <form onSubmit={addDay} className="flex flex-wrap gap-2">
        <input
          className={`${inputCls} flex-1 min-w-[140px]`}
          placeholder="New day label (e.g. Monday — Push)"
          value={dayLabelDraft}
          onChange={e => setDayLabelDraft(e.target.value)}
        />
        <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-500">
          <Plus size={14} />
          Add day
        </button>
      </form>

      <div className="space-y-2">
        {programme.days.length === 0 ? (
          <p className="text-xs text-pens-cream/40">No days yet.</p>
        ) : (
          programme.days.map(day => (
            <div key={day.id} className="rounded-xl border border-pens-muted/25 bg-pens-deep/60 overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-pens-deep/40"
                onClick={() => toggleDay(day.id)}
              >
                <span className="text-sm font-semibold text-pens-cream">{day.dayLabel}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      deleteDay(day.id)
                    }}
                    className="text-pens-cream/30 hover:text-pens-crimson p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                  {openDays[day.id] ? <ChevronDown size={16} className="text-orange-400" /> : <ChevronRight size={16} className="text-orange-400" />}
                </div>
              </button>
              {openDays[day.id] && (
                <div className="border-t border-pens-muted/20 px-4 py-3 space-y-3">
                  <ul className="space-y-2 text-sm">
                    {day.exercises.length === 0 ? (
                      <li className="text-pens-cream/40 text-xs">No exercises.</li>
                    ) : (
                      day.exercises.map(ex => (
                        <li key={ex.id} className="flex items-center justify-between gap-2 border-b border-pens-muted/15 pb-2 last:border-0">
                          <span className="text-pens-cream">
                            {ex.name}{' '}
                            <span className="text-pens-cream/50">
                              {ex.sets}×{ex.reps}
                              {ex.weightKg != null ? ` @ ${ex.weightKg} kg` : ''}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteExercise(day.id, ex.id)}
                            className="text-pens-cream/30 hover:text-pens-crimson"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="rounded-lg bg-pens-surface/30 p-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">Add exercise</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                      <input
                        className={`${inputCls} col-span-2 sm:col-span-2`}
                        placeholder="Name"
                        value={exForms[day.id]?.name ?? ''}
                        onChange={e =>
                          setExForms(h => ({
                            ...h,
                            [day.id]: { ...(h[day.id] ?? { name: '', sets: '3', reps: '8', weightKg: '' }), name: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="number"
                        min={1}
                        className={inputCls}
                        placeholder="Sets"
                        value={exForms[day.id]?.sets ?? '3'}
                        onChange={e =>
                          setExForms(h => ({
                            ...h,
                            [day.id]: { ...(h[day.id] ?? { name: '', sets: '3', reps: '8', weightKg: '' }), sets: e.target.value },
                          }))
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder="Reps"
                        value={exForms[day.id]?.reps ?? '8'}
                        onChange={e =>
                          setExForms(h => ({
                            ...h,
                            [day.id]: { ...(h[day.id] ?? { name: '', sets: '3', reps: '8', weightKg: '' }), reps: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="number"
                        step="0.5"
                        className={inputCls}
                        placeholder="kg (opt)"
                        value={exForms[day.id]?.weightKg ?? ''}
                        onChange={e =>
                          setExForms(h => ({
                            ...h,
                            [day.id]: { ...(h[day.id] ?? { name: '', sets: '3', reps: '8', weightKg: '' }), weightKg: e.target.value },
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => addExercise(day.id)}
                        className="rounded-lg bg-pens-muted/40 px-3 py-2 text-xs font-bold uppercase text-pens-cream hover:bg-orange-600"
                      >
                        <Check className="inline mr-1" size={14} />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
