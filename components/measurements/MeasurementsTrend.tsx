'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Trash2, Pencil, Check, X } from 'lucide-react'

interface Entry {
  id: string
  date: string
  waistCm: number | null
  chestCm: number | null
  hipsCm: number | null
  leftArmCm: number | null
  rightArmCm: number | null
  leftThighCm: number | null
  rightThighCm: number | null
  neckCm: number | null
  notes: string | null
}

type EditForm = Record<string, string>

const LINES = [
  { key: 'waistCm',      label: 'Waist',   color: '#f43f5e' },
  { key: 'chestCm',      label: 'Chest',   color: '#3b82f6' },
  { key: 'hipsCm',       label: 'Hips',    color: '#a855f7' },
  { key: 'leftArmCm',    label: 'L-Arm',   color: '#f97316' },
  { key: 'rightArmCm',   label: 'R-Arm',   color: '#fb923c' },
  { key: 'leftThighCm',  label: 'L-Thigh', color: '#22c55e' },
  { key: 'rightThighCm', label: 'R-Thigh', color: '#16a34a' },
  { key: 'neckCm',       label: 'Neck',    color: '#64748b' },
]

interface Props { refreshKey?: number }

export default function MeasurementsTrend({ refreshKey }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState<Set<string>>(new Set(['waistCm', 'chestCm', 'hipsCm']))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/measurements')
      if (res.ok) setEntries(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [refreshKey])

  const handleDelete = async (id: string) => {
    await fetch('/api/measurements', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setEntries(e => e.filter(x => x.id !== id))
  }

  const startEdit = (e: Entry) => {
    setEditingId(e.id)
    const form: EditForm = { notes: e.notes ?? '' }
    for (const { key } of LINES) {
      const v = (e as unknown as Record<string, number | null>)[key]
      form[key] = v != null ? String(v) : ''
    }
    setEditForm(form)
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(null) }

  const saveEdit = async (id: string) => {
    if (!editForm) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { id, notes: editForm.notes }
      for (const { key } of LINES) {
        payload[key] = editForm[key] !== '' ? parseFloat(editForm[key]) : null
      }
      const res = await fetch('/api/measurements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { load(); cancelEdit() }
    } finally {
      setSaving(false)
    }
  }

  const toggleLine = (key: string) => {
    setVisible(v => {
      const next = new Set(v)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (loading) return <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
  if (!entries.length) return <div className="text-sm text-gray-400 py-6 text-center">No measurements logged yet</div>

  const chartData = [...entries].reverse().map(e => ({
    date: e.date.slice(5),
    waistCm: e.waistCm, chestCm: e.chestCm, hipsCm: e.hipsCm,
    leftArmCm: e.leftArmCm, rightArmCm: e.rightArmCm,
    leftThighCm: e.leftThighCm, rightThighCm: e.rightThighCm, neckCm: e.neckCm,
  }))

  const latest = entries[0]
  const prev   = entries[1]

  return (
    <div className="space-y-6">
      {latest && (
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Latest — {latest.date}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LINES.map(({ key, label, color }) => {
              const val     = (latest as unknown as Record<string, number | null>)[key]
              const prevVal = prev ? (prev as unknown as Record<string, number | null>)[key] : null
              const delta   = val != null && prevVal != null ? val - prevVal : null
              if (val == null) return null
              return (
                <div key={key} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-medium mb-0.5" style={{ color }}>{label}</p>
                  <p className="text-lg font-bold text-gray-900">{val} cm</p>
                  {delta != null && (
                    <p className={`text-xs font-medium ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)} cm
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {chartData.length >= 2 && (
        <div className="bg-white rounded-2xl shadow p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {LINES.map(({ key, label, color }) => (
              <button
                key={key} type="button" onClick={() => toggleLine(key)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  visible.has(key) ? 'text-white border-transparent' : 'bg-white text-gray-400 border-gray-200'
                }`}
                style={visible.has(key) ? { backgroundColor: color, borderColor: color } : {}}
              >
                {label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} unit=" cm" />
              <Tooltip formatter={(v) => [`${v} cm`]} />
              {LINES.filter(l => visible.has(l.key)).map(({ key, label, color }) => (
                <Line key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">History</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {entries.map(e => (
            <div key={e.id}>
              {editingId === e.id && editForm ? (
                <div className="px-5 py-4 bg-rose-50">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-3">
                    {LINES.map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-xs text-gray-500 mb-0.5 block">{label} (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="—"
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-400"
                          value={editForm[key]}
                          onChange={ev => setEditForm(f => f ? { ...f, [key]: ev.target.value } : f)}
                        />
                      </div>
                    ))}
                    <div className="col-span-2 sm:col-span-4">
                      <label className="text-xs text-gray-500 mb-0.5 block">Notes</label>
                      <input
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-400"
                        placeholder="Notes (optional)"
                        value={editForm.notes}
                        onChange={ev => setEditForm(f => f ? { ...f, notes: ev.target.value } : f)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><X size={12} /> Cancel</button>
                    <button onClick={() => saveEdit(e.id)} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"><Check size={12} /> Save</button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 flex items-start justify-between group">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{e.date}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {LINES.map(({ key, label }) => {
                        const v = (e as unknown as Record<string, number | null>)[key]
                        return v != null ? `${label}: ${v}` : null
                      }).filter(Boolean).join(' · ')}
                    </p>
                    {e.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{e.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button type="button" onClick={() => startEdit(e)} className="text-gray-300 hover:text-rose-400 p-1 rounded" title="Edit"><Pencil size={14} /></button>
                    <button type="button" onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 size={14} /></button>
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
