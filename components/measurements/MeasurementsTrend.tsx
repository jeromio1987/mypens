'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Trash2, Pencil, Check, X, Camera } from 'lucide-react'

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
  photoPath: string | null
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

const editInputCls = 'w-full text-sm bg-pens-navy border border-pens-muted/40 rounded-lg px-2 py-1.5 text-pens-cream placeholder:text-pens-cream/30 focus:outline-none focus:border-rose-500/60'

export default function MeasurementsTrend({ refreshKey }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState<Set<string>>(new Set(['waistCm', 'chestCm', 'hipsCm']))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [photoModal, setPhotoModal] = useState<{ src: string; date: string } | null>(null)

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

  if (loading) return <div className="text-sm text-pens-cream/40 py-6 text-center">Loading…</div>

  if (!entries.length) {
    return (
      <div className="bg-pens-surface/60 border border-pens-muted/20 rounded-2xl p-6 text-center">
        <div className="relative w-32 h-32 mx-auto mb-4 opacity-60">
          <Image
            src="/illustrations/dadbod-mascot.png"
            alt=""
            fill
            sizes="128px"
            className="object-contain grayscale"
          />
        </div>
        <p className="text-sm text-pens-cream font-semibold mb-1">Inventory the wreckage</p>
        <p className="text-xs text-pens-cream/50 max-w-xs mx-auto leading-relaxed">
          No measurements logged yet. Drop the tape, snap a starter photo, file the first entry. The trendline starts after two.
        </p>
      </div>
    )
  }

  const photoEntries = entries.filter(e => e.photoPath).slice(0, 12)

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
        <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
          <h3 className="font-semibold text-pens-cream mb-3">Latest — {latest.date}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LINES.map(({ key, label, color }) => {
              const val     = (latest as unknown as Record<string, number | null>)[key]
              const prevVal = prev ? (prev as unknown as Record<string, number | null>)[key] : null
              const delta   = val != null && prevVal != null ? val - prevVal : null
              if (val == null) return null
              return (
                <div key={key} className="bg-pens-navy/40 rounded-xl p-3">
                  <p className="text-xs font-medium mb-0.5" style={{ color }}>{label}</p>
                  <p className="text-lg font-bold text-pens-cream">{val} cm</p>
                  {delta != null && (
                    <p className={`text-xs font-medium ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-pens-cream/40'}`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)} cm
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Progress photo strip */}
      {photoEntries.length > 0 && (
        <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-pens-cream flex items-center gap-2">
              <Camera size={14} className="text-pens-gold" />
              Progress photos
            </h3>
            <span className="text-xs text-pens-cream/40">{photoEntries.length} {photoEntries.length === 1 ? 'photo' : 'photos'}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 snap-x">
            {photoEntries.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => e.photoPath && setPhotoModal({ src: e.photoPath, date: e.date })}
                className="relative w-24 h-32 shrink-0 rounded-lg overflow-hidden border border-pens-muted/30 bg-pens-navy hover:border-pens-gold/60 transition-colors snap-start"
              >
                <Image src={e.photoPath!} alt={`Progress ${e.date}`} fill sizes="96px" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-pens-deep/95 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-pens-cream font-medium">{e.date.slice(5)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {chartData.length >= 2 && (
        <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {LINES.map(({ key, label, color }) => (
              <button
                key={key} type="button" onClick={() => toggleLine(key)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  visible.has(key) ? 'text-white border-transparent' : 'bg-transparent text-pens-cream/40 border-pens-muted/30 hover:border-pens-muted/60'
                }`}
                style={visible.has(key) ? { backgroundColor: color, borderColor: color } : {}}
              >
                {label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D405B50" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#F5E6D360' }} />
              <YAxis tick={{ fontSize: 11, fill: '#F5E6D360' }} domain={['auto', 'auto']} unit=" cm" />
              <Tooltip
                contentStyle={{ backgroundColor: '#2B2D42', border: '1px solid #3D405B80', borderRadius: '8px', color: '#F5E6D3' }}
                formatter={(v) => [`${v} cm`]}
              />
              {LINES.filter(l => visible.has(l.key)).map(({ key, label, color }) => (
                <Line key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-pens-muted/20">
          <h3 className="font-semibold text-pens-cream">History</h3>
        </div>
        <div className="divide-y divide-pens-muted/10">
          {entries.map(e => (
            <div key={e.id}>
              {editingId === e.id && editForm ? (
                <div className="px-5 py-4 bg-rose-900/10 border-l-2 border-rose-500/30">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-3">
                    {LINES.map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-xs text-pens-cream/50 mb-0.5 block">{label} (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="—"
                          className={editInputCls}
                          value={editForm[key]}
                          onChange={ev => setEditForm(f => f ? { ...f, [key]: ev.target.value } : f)}
                        />
                      </div>
                    ))}
                    <div className="col-span-2 sm:col-span-4">
                      <label className="text-xs text-pens-cream/50 mb-0.5 block">Notes</label>
                      <input
                        className={editInputCls}
                        placeholder="Notes (optional)"
                        value={editForm.notes}
                        onChange={ev => setEditForm(f => f ? { ...f, notes: ev.target.value } : f)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-pens-muted/40 text-pens-cream/50 hover:text-pens-cream"><X size={12} /> Cancel</button>
                    <button onClick={() => saveEdit(e.id)} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"><Check size={12} /> Save</button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 flex items-start justify-between group hover:bg-pens-navy/20 transition-colors gap-3">
                  {e.photoPath && (
                    <button
                      type="button"
                      onClick={() => setPhotoModal({ src: e.photoPath!, date: e.date })}
                      className="relative w-12 h-16 shrink-0 rounded-md overflow-hidden border border-pens-muted/30 bg-pens-navy hover:border-pens-gold/60 transition-colors"
                      aria-label={`View photo from ${e.date}`}
                    >
                      <Image src={e.photoPath} alt="" fill sizes="48px" className="object-cover" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-pens-cream">{e.date}</p>
                    <p className="text-xs text-pens-cream/50 mt-0.5">
                      {LINES.map(({ key, label }) => {
                        const v = (e as unknown as Record<string, number | null>)[key]
                        return v != null ? `${label}: ${v}` : null
                      }).filter(Boolean).join(' · ')}
                    </p>
                    {e.notes && <p className="text-xs text-pens-cream/40 mt-0.5 italic">{e.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button type="button" onClick={() => startEdit(e)} className="text-pens-cream/30 hover:text-rose-400 p-1 rounded" title="Edit"><Pencil size={14} /></button>
                    <button type="button" onClick={() => handleDelete(e.id)} className="text-pens-cream/30 hover:text-red-400 p-1 rounded"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Photo modal */}
      {photoModal && (
        <div
          className="fixed inset-0 z-50 bg-pens-deep/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPhotoModal(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-pens-cream/60">Progress · {photoModal.date}</p>
              <button
                onClick={() => setPhotoModal(null)}
                aria-label="Close"
                className="text-pens-cream/60 hover:text-pens-cream"
              >
                <X size={20} />
              </button>
            </div>
            <div className="relative w-full flex-1 min-h-[60vh] bg-pens-navy rounded-xl overflow-hidden border border-pens-muted/30">
              <Image
                src={photoModal.src}
                alt={`Progress photo from ${photoModal.date}`}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
