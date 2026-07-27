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
  quality: number | null
  hrv?: number | null
  notes?: string | null
  source?: string
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
  return '#3D405B'
}

const editInputCls = 'w-full text-sm bg-pens-navy border border-pens-muted/40 rounded-lg px-2 py-1.5 text-pens-cream focus:outline-none focus:border-violet-500/60'
const editSelectCls = 'w-full text-sm bg-pens-navy border border-pens-muted/40 rounded-lg px-2 py-1.5 text-pens-cream focus:outline-none focus:border-violet-500/60'

interface Props {
  entries: SleepEntry[]
  loading?: boolean
  onSleepDataMutate: () => void | Promise<void>
}

export default function SleepTrend({
  entries: rawEntries,
  loading: parentLoading,
  onSleepDataMutate,
}: Props) {
  const [data, setData] = useState<ChartEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const sorted = [...rawEntries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map(e => ({
        ...e,
        label: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short',
        }),
        qualityLine: e.quality ?? 0,
      }))
    setData(sorted)
  }, [rawEntries])

  const handleDelete = async (id: string) => {
    await fetch('/api/sleep', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await onSleepDataMutate()
  }

  const startEdit = (e: SleepEntry) => {
    setEditingId(e.id)
    setEditForm({
      bedtime:  e.bedtime,
      wakeTime: e.wakeTime,
      quality:  e.quality != null ? String(e.quality) : '',
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
      if (res.ok) {
        await onSleepDataMutate()
        cancelEdit()
      }
    } finally {
      setSaving(false)
    }
  }

  if (parentLoading)
    return <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 text-sm text-pens-cream/40">Loading chart…</div>

  if (data.length === 0)
    return <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 text-sm text-pens-cream/40">No sleep entries yet — log your first night above.</div>

  const avgHours   = (data.reduce((s, e) => s + e.hours,   0) / data.length).toFixed(1)
  const withQ = data.filter(e => e.quality != null)
  const avgQuality = withQ.length
    ? (withQ.reduce((s, e) => s + (e.quality as number), 0) / withQ.length).toFixed(1)
    : '—'

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 w-full">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold text-pens-cream">30-Day Sleep Trend</h2>
        <div className="flex gap-4 text-sm text-pens-cream/50">
          <span>Avg <strong className="text-violet-400">{avgHours}h</strong></span>
          <span>Quality <strong className="text-violet-400">{avgQuality}/5</strong></span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3D405B50" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#F5E6D360' }} />
          <YAxis yAxisId="hours" domain={[0, 12]} tick={{ fontSize: 11, fill: '#F5E6D360' }} unit="h" width={36} />
          <YAxis yAxisId="quality" orientation="right" domain={[0, 5]} tick={{ fontSize: 11, fill: '#F5E6D360' }} width={28} />
          <Tooltip
            contentStyle={{ backgroundColor: '#2B2D42', border: '1px solid #3D405B80', borderRadius: '8px', color: '#F5E6D3' }}
            formatter={(value, name) => {
              if (name === 'hours') return [`${value}h`, 'Sleep duration']
              if (name === 'qualityLine') return [`${value}/5`, 'Quality']
              return [value, name]
            }}
          />
          <Legend
            wrapperStyle={{ color: '#F5E6D380', fontSize: '11px' }}
            formatter={(v) => (v === 'hours' ? 'Duration' : v === 'qualityLine' ? 'Quality (right axis)' : v)}
          />
          <Bar yAxisId="hours" dataKey="hours" radius={[4, 4, 0, 0]} name="hours">
            {data.map((entry, i) => <Cell key={i} fill={qualityColor(entry.quality ?? 0)} />)}
          </Bar>
          <Line yAxisId="quality" type="monotone" dataKey="qualityLine" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="qualityLine" />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-5">
        <h3 className="text-sm font-medium text-pens-cream/60 mb-2">History</h3>
        <div className="space-y-px max-h-56 overflow-y-auto">
          {[...data].reverse().map(e => (
            <div key={e.id}>
              {editingId === e.id && editForm ? (
                <div className="bg-violet-900/20 border border-violet-500/20 rounded-xl p-3 space-y-2 mb-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-pens-cream/50 mb-0.5 block">Bedtime</label>
                      <input type="time" className={editInputCls} value={editForm.bedtime} onChange={ev => setEditForm(f => f ? { ...f, bedtime: ev.target.value } : f)} />
                    </div>
                    <div>
                      <label className="text-xs text-pens-cream/50 mb-0.5 block">Wake time</label>
                      <input type="time" className={editInputCls} value={editForm.wakeTime} onChange={ev => setEditForm(f => f ? { ...f, wakeTime: ev.target.value } : f)} />
                    </div>
                    <div>
                      <label className="text-xs text-pens-cream/50 mb-0.5 block">Quality (1–5)</label>
                      <select className={editSelectCls} value={editForm.quality} onChange={ev => setEditForm(f => f ? { ...f, quality: ev.target.value } : f)}>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {QUALITY_LABELS[n]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-pens-cream/50 mb-0.5 block">HRV (ms, opt.)</label>
                      <input type="number" className={editInputCls} placeholder="e.g. 55" value={editForm.hrv} onChange={ev => setEditForm(f => f ? { ...f, hrv: ev.target.value } : f)} />
                    </div>
                    <div className="col-span-2">
                      <input className={editInputCls} placeholder="Notes (optional)" value={editForm.notes} onChange={ev => setEditForm(f => f ? { ...f, notes: ev.target.value } : f)} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-pens-muted/40 text-pens-cream/50 hover:text-pens-cream hover:border-pens-muted/60"><X size={12} /> Cancel</button>
                    <button onClick={() => saveEdit(e.id)} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"><Check size={12} /> Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm py-2 px-2 rounded-lg hover:bg-pens-navy/30 group">
                  <span className="text-pens-cream/40 w-16 shrink-0">{e.label}</span>
                  <span className="font-medium w-12 text-pens-cream">{e.hours}h</span>
                  <span className="text-violet-400 w-6 text-center font-medium">
                    {e.quality != null ? `${e.quality}★` : '—'}
                  </span>
                  <span className="text-pens-cream/40 text-xs">{e.bedtime} → {e.wakeTime}</span>
                  {e.hrv && <span className="text-teal-400 text-xs ml-1">HRV {e.hrv}ms</span>}
                  {e.notes && <span className="text-pens-cream/40 text-xs truncate max-w-[120px]">{e.notes}</span>}
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(e)} className="text-pens-cream/30 hover:text-violet-400" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(e.id)} className="text-pens-cream/30 hover:text-red-400" title="Delete"><Trash2 size={13} /></button>
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
