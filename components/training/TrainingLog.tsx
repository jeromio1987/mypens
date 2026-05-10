'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

interface TrainingEntry {
  id: string
  date: string
  exercise: string
  sets: number
  reps: number
  weightKg: number
  rpe?: number
  notes?: string
  volume: number
  source?: string
  externalUrl?: string | null
}

interface EditForm {
  exercise: string
  sets: string
  reps: string
  weightKg: string
  rpe: string
  notes: string
}

interface SessionGroup {
  date: string
  label: string
  entries: TrainingEntry[]
  totalVolume: number
}

interface WeeklyBar {
  week: string
  volume: number
}

interface Props {
  date: string
  refresh: number
}

const GOLD = '#C9A84C'
const GOLD_DIM = '#7B6730'
const CREAM = '#F5E6D3'
const MUTED = '#3D405B'

const editInputCls = 'text-sm bg-pens-deep border border-pens-muted/40 text-pens-cream rounded-lg px-2 py-1.5 placeholder:text-pens-cream/30 focus:outline-none focus:ring-1 focus:ring-pens-gold focus:border-pens-gold'

function groupByDate(entries: TrainingEntry[]): SessionGroup[] {
  const map = new Map<string, TrainingEntry[]>()
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date)!.push(e)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, es]) => ({
      date,
      label: new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
      }),
      entries: es,
      totalVolume: parseFloat(es.reduce((s, e) => s + e.volume, 0).toFixed(0)),
    }))
}

function weeklyVolume(entries: TrainingEntry[]): WeeklyBar[] {
  const map = new Map<string, number>()
  for (const e of entries) {
    const d = new Date(e.date + 'T00:00:00')
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    const weekKey = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    map.set(weekKey, (map.get(weekKey) || 0) + e.volume)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([week, volume]) => ({ week, volume: parseFloat(volume.toFixed(0)) }))
}

export default function TrainingLog({ date, refresh }: Props) {
  const [allEntries, setAllEntries] = useState<TrainingEntry[]>([])
  const [todayEntries, setTodayEntries] = useState<TrainingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/training').then(r => r.json()),
      fetch(`/api/training?date=${date}`).then(r => r.json()),
    ]).then(([all, today]) => {
      setAllEntries(all)
      setTodayEntries(today)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [refresh, date])

  const handleDelete = async (id: string) => {
    await fetch('/api/training', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const startEdit = (e: TrainingEntry) => {
    setEditingId(e.id)
    setEditForm({
      exercise: e.exercise,
      sets:     String(e.sets),
      reps:     String(e.reps),
      weightKg: String(e.weightKg),
      rpe:      e.rpe != null ? String(e.rpe) : '',
      notes:    e.notes ?? '',
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(null) }

  const saveEdit = async (id: string) => {
    if (!editForm) return
    setSaving(true)
    try {
      const res = await fetch('/api/training', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          exercise: editForm.exercise,
          sets:     parseFloat(editForm.sets)     || 1,
          reps:     parseFloat(editForm.reps)     || 1,
          weightKg: parseFloat(editForm.weightKg) || 0,
          rpe:      editForm.rpe !== '' ? parseFloat(editForm.rpe) : null,
          notes:    editForm.notes,
        }),
      })
      if (res.ok) {
        load()
        cancelEdit()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <div className="bg-pens-surface border border-pens-muted/30 rounded-2xl shadow p-6 text-sm text-pens-cream/40">Loading…</div>

  const sessions = groupByDate(allEntries)
  const weekly = weeklyVolume(allEntries)
  const todayVolume = todayEntries.reduce((s, e) => s + e.volume, 0).toFixed(0)

  const renderRow = (e: TrainingEntry) => {
    if (editingId === e.id && editForm) {
      return (
        <div key={e.id} className="bg-pens-deep/60 border border-pens-gold/30 rounded-xl p-3 mb-1 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <input
                className={`${editInputCls} w-full`}
                placeholder="Exercise name"
                value={editForm.exercise}
                onChange={ev => setEditForm(f => f ? { ...f, exercise: ev.target.value } : f)}
              />
            </div>
            <input className={editInputCls} placeholder="Sets"        type="number" value={editForm.sets}     onChange={ev => setEditForm(f => f ? { ...f, sets:     ev.target.value } : f)} />
            <input className={editInputCls} placeholder="Reps"        type="number" value={editForm.reps}     onChange={ev => setEditForm(f => f ? { ...f, reps:     ev.target.value } : f)} />
            <input className={editInputCls} placeholder="Weight (kg)" type="number" value={editForm.weightKg} onChange={ev => setEditForm(f => f ? { ...f, weightKg: ev.target.value } : f)} />
            <input className={editInputCls} placeholder="RPE (opt.)"  type="number" min="1" max="10" value={editForm.rpe} onChange={ev => setEditForm(f => f ? { ...f, rpe: ev.target.value } : f)} />
            <div className="col-span-2">
              <input
                className={`${editInputCls} w-full`}
                placeholder="Notes (optional)"
                value={editForm.notes}
                onChange={ev => setEditForm(f => f ? { ...f, notes: ev.target.value } : f)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={cancelEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-pens-muted/40 text-pens-cream/70 hover:bg-pens-muted/20">
              <X size={12} /> Cancel
            </button>
            <button onClick={() => saveEdit(e.id)} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-pens-crimson text-pens-cream hover:bg-pens-red disabled:opacity-50">
              <Check size={12} /> Save
            </button>
          </div>
        </div>
      )
    }
    return (
      <div
        key={e.id}
        className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-pens-deep/60 group text-sm text-pens-cream/80"
      >
        <Link
          href={`/training/exercise/${encodeURIComponent(e.exercise)}`}
          className="font-medium flex-1 text-left text-pens-gold hover:underline flex items-center gap-1.5 min-w-0"
          title="Exercise progression"
        >
          <span className="truncate">{e.exercise}</span>
          {e.source === 'strava' && (
            <span
              className="inline-flex shrink-0 items-center text-[9px] uppercase tracking-wide font-bold bg-pens-crimson/30 text-pens-cream rounded px-1 py-0.5"
              title="Imported from Strava"
            >
              Strava
            </span>
          )}
        </Link>
        <span className="text-pens-cream/60 text-xs">
          {e.sets}×{e.reps}
          {e.weightKg > 0 ? ` @ ${e.weightKg}kg` : ' BW'}
        </span>
        {e.rpe && <span className="text-xs text-pens-cream/40">RPE {e.rpe}</span>}
        {e.volume > 0 && (
          <span className="text-pens-gold text-xs font-medium w-20 text-right">{e.volume} kg</span>
        )}
        {e.notes && <span className="text-pens-cream/40 text-xs truncate max-w-[100px]">{e.notes}</span>}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => startEdit(e)} className="text-pens-cream/40 hover:text-pens-gold" title="Edit">
            <Pencil size={13} />
          </button>
          <button onClick={() => handleDelete(e.id)} className="text-pens-cream/40 hover:text-pens-crimson" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-pens-surface border border-pens-muted/30 rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-pens-cream">Today&apos;s Session</h2>
          {todayEntries.length > 0 && (
            <span className="text-sm text-pens-gold font-medium">
              Total volume: {parseFloat(todayVolume) > 0 ? `${todayVolume} kg` : 'bodyweight'}
            </span>
          )}
        </div>
        {todayEntries.length === 0 ? (
          <p className="text-sm text-pens-cream/40">No exercises logged for this date.</p>
        ) : (
          <div className="space-y-px">{todayEntries.map(renderRow)}</div>
        )}
      </div>

      {weekly.length > 0 && (
        <div className="bg-pens-surface border border-pens-muted/30 rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-pens-cream">Weekly Volume (kg)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={MUTED} opacity={0.3} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: CREAM, fillOpacity: 0.6 }} stroke={MUTED} />
              <YAxis tick={{ fontSize: 11, fill: CREAM, fillOpacity: 0.6 }} unit=" kg" width={56} stroke={MUTED} />
              <Tooltip
                formatter={(v) => [`${v} kg`, 'Volume']}
                contentStyle={{ background: '#0D1B2A', border: `1px solid ${MUTED}`, borderRadius: 8, color: CREAM }}
                labelStyle={{ color: CREAM }}
                cursor={{ fill: MUTED, opacity: 0.2 }}
              />
              <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                {weekly.map((_, i) => (
                  <Cell key={i} fill={i === weekly.length - 1 ? GOLD : GOLD_DIM} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="bg-pens-surface border border-pens-muted/30 rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-pens-cream">Recent Sessions</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {sessions.slice(0, 14).map(s => (
              <div key={s.date}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-pens-cream/80">{s.label}</span>
                  {s.totalVolume > 0 && (
                    <span className="text-xs text-pens-gold">{s.totalVolume} kg total</span>
                  )}
                </div>
                <div className="space-y-px pl-2 border-l-2 border-pens-gold/30">
                  {s.entries.map(e => (
                    <div key={e.id} className="flex items-center gap-2 text-xs text-pens-cream/60 py-0.5">
                      <Link
                        href={`/training/exercise/${encodeURIComponent(e.exercise)}`}
                        className="font-medium text-pens-gold hover:underline text-left flex items-center gap-1 truncate"
                      >
                        <span>{e.exercise}</span>
                        {e.source === 'strava' && (
                          <span className="text-[9px] uppercase tracking-wide font-bold bg-pens-crimson/30 text-pens-cream rounded px-1 shrink-0" title="Strava">
                            S
                          </span>
                        )}
                      </Link>
                      <span>{e.sets}×{e.reps}{e.weightKg > 0 ? ` @ ${e.weightKg}kg` : ' BW'}</span>
                      {e.rpe && <span className="text-pens-cream/40">RPE {e.rpe}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
