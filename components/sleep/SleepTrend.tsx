'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { Trash2, Pencil, Check, X } from 'lucide-react'

interface SleepEntry {
  id: string
  date: string
  bedtime: string
  wakeTime: string
  hours: number
  quality: number
  hrv?: number
  notes?: string
}

interface ChartEntry extends SleepEntry {
  label: string
  qualityLine: number
}

interface EditForm {
  bedtime: string
  wakeTime: string
  quality: string
  hrv: string
  notes: string
}

const QUALITY_LABELS: Record<number, string> = {
  1: 'Very poor', 2: 'Poor', 3: 'Fair', 4: 'Good', 5: 'Excellent',
}

const qualityColor = (q: number) => {
  if (q >= 5) return '#7c3aed'
  if (q >= 4) return '#8b5cf6'
  if (q >= 3) return '#a78bfa'
  if (q >= 2) return '#c4b5fd'
  return '#e5e7eb'
}

export default function SleepTrend({ refresh }: { refresh?: number }) {
  const [data, setData] = useState<ChartEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/sleep')
      .then(r => r.json())
      .then((entries: SleepEntry[]) => {
        const sorted = [...entries]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30)
          .map(e => ({
            ...e,
            label: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short',
            }),
            qualityLine: e.quality,
          }))
        setData(sorted)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [refresh])

  const handleDelete = async (id: string) => {
    await fetch('/api/sleep', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const startEdit = (e: SleepEntry) => {
    setEditingId(e.id)
    setEditForm({
      bedtime:  e.bedtime,
      wakeTime: e.wakeTime,
      quality:  String(e.quality),
      hrv:      e.hrv != null ? String(e.hrv) : '',
      notes:    e.notes ?? '',
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(null) }

  const saveEdit = async (id: string) => {
    if (!editForm) return
    setSaving(true)
    try {
      const res = await fetch('/api/sleep', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          bedtime:  editForm.bedtime,
          wakeTime: editForm.wakeTime,
          quality:  Number(editForm.quality),
          hrv:      editForm.hrv !== '' ? Number(editForm.hrv) : null,
          notes:    editForm.notes,
        }),
      })
      if (res.ok) { load(); cancelEdit() }
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">Loading chart…</div>

  if (data.length === 0)
    return <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">No sleep entries yet — log your first night above.</div>

  const avgHours   = (data.reduce((s, e) => s + e.hours,   0) / data.length).toFixed(1)
  const avgQuality = (data.reduce((s, e) => s + e.quality, 0) / data.length).toFixed(1)

  return (
    <div className="bg-white rounded-2xl shadow p-6 w-full">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold">30-Day Sleep Trend</h2>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Avg <strong className="text-violet-600">{avgHours}h</strong></span>
          <span>Quality <strong className="text-violet-600">{avgQuality}/5</strong></span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="hours" domain={[0, 12]} tick={{ fontSize: 11 }} unit="h" width={36} />
          <YAxis yAxisId="quality" orientation="right" domain={[0, 5]} tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'hours') return [`${value}h`, 'Sleep duration']
              if (name === 'qualityLine') return [`${value}/5`, 'Quality']
              return [value, name]
            }}
          />
          <Legend formatter={(v) => (v === 'hours' ? 'Duration' : v === 'qualityLine' ? 'Quality (right axis)' : v)} />
          <Bar yAxisId="hours" dataKey="hours" radius={[4, 4, 0, 0]} name="hours">
            {data.map((entry, i) => <Cell key={i} fill={qualityColor(entry.quality)} />)}
          </Bar>
          <Line yAxisId="quality" type="monotone" dataKey="qualityLine" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="qualityLine" />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-5">
        <h3 className="text-sm font-medium text-gray-600 mb-2">History</h3>
        <div className="space-y-px max-h-56 overflow-y-auto">
          {[...data].reverse().map(e => (
            <div key={e.id}>
              {editingId === e.id && editForm ? (
                <div className="bg-violet-50 rounded-xl p-3 space-y-2 mb-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Bedtime</label>
                      <input type="time" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400" value={editForm.bedtime}  onChange={ev => setEditForm(f => f ? { ...f, bedtime:  ev.target.value } : f)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Wake time</label>
                      <input type="time" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400" value={editForm.wakeTime} onChange={ev => setEditForm(f => f ? { ...f, wakeTime: ev.target.value } : f)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Quality (1–5)</label>
                      <select className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400" value={editForm.quality} onChange={ev => setEditForm(f => f ? { ...f, quality: ev.target.value } : f)}>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {QUALITY_LABELS[n]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">HRV (ms, opt.)</label>
                      <input type="number" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400" placeholder="e.g. 55" value={editForm.hrv}   onChange={ev => setEditForm(f => f ? { ...f, hrv:   ev.target.value } : f)} />
                    </div>
                    <div className="col-span-2">
                      <input className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400" placeholder="Notes (optional)" value={editForm.notes} onChange={ev => setEditForm(f => f ? { ...f, notes: ev.target.value } : f)} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><X size={12} /> Cancel</button>
                    <button onClick={() => saveEdit(e.id)} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50"><Check size={12} /> Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm py-2 px-2 rounded-lg hover:bg-gray-50 group">
                  <span className="text-gray-400 w-16 shrink-0">{e.label}</span>
                  <span className="font-medium w-12">{e.hours}h</span>
                  <span className="text-violet-600 w-6 text-center font-medium">{e.quality}★</span>
                  <span className="text-gray-400 text-xs">{e.bedtime} → {e.wakeTime}</span>
                  {e.hrv && <span className="text-teal-500 text-xs ml-1">HRV {e.hrv}ms</span>}
                  {e.notes && <span className="text-gray-400 text-xs truncate max-w-[120px]">{e.notes}</span>}
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(e)} className="text-gray-300 hover:text-violet-400" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(e.id)} className="text-gray-300 hover:text-red-400" title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
