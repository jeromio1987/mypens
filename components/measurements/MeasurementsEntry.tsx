'use client'

import { useState } from 'react'
import QuickToggle from '@/components/shared/QuickToggle'
import PresetPicker from '@/components/shared/PresetPicker'

interface Props {
  onSaved?: () => void
}

const FIELDS = [
  { key: 'waistCm', label: 'Waist', placeholder: '80', priority: true },
  { key: 'chestCm', label: 'Chest', placeholder: '100', priority: true },
  { key: 'hipsCm', label: 'Hips', placeholder: '95', priority: true },
  { key: 'leftArmCm', label: 'Left arm', placeholder: '35', priority: false },
  { key: 'rightArmCm', label: 'Right arm', placeholder: '35', priority: false },
  { key: 'leftThighCm', label: 'Left thigh', placeholder: '58', priority: false },
  { key: 'rightThighCm', label: 'Right thigh', placeholder: '58', priority: false },
  { key: 'neckCm', label: 'Neck', placeholder: '38', priority: false },
]

const inputCls = 'w-full bg-pens-navy border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream placeholder:text-pens-cream/30 focus:outline-none focus:border-pens-cream/30'
const labelCls = 'block text-sm font-medium text-pens-cream/80 mb-1'
const labelSmCls = 'block text-xs font-medium text-pens-cream/50 mb-1'

export default function MeasurementsEntry({ onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [quick, setQuick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blank = Object.fromEntries(FIELDS.map(f => [f.key, '']))
  const [form, setForm] = useState<Record<string, string>>({ date: today, notes: '', ...blank })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (data: Record<string, unknown>) => {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
      next[k] = v != null ? String(v) : ''
    }
    setForm(f => ({ ...f, ...next }))
  }

  const visibleFields = quick ? FIELDS.filter(f => f.priority) : FIELDS

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload: Record<string, unknown> = { date: form.date, notes: form.notes || undefined }
      for (const f of FIELDS) {
        payload[f.key] = form[f.key] !== '' ? parseFloat(form[f.key]) : undefined
      }
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      onSaved?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const presetValues = Object.fromEntries(FIELDS.map(f => [f.key, form[f.key]]).filter(([, v]) => v !== ''))

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold text-pens-cream">Log Measurements</h2>
        <QuickToggle quick={quick} onChange={setQuick} />
      </div>

      <div className="mb-4">
        <PresetPicker
          module="measurements"
          onApply={applyPreset}
          currentValues={Object.keys(presetValues).length > 0 ? presetValues : undefined}
          accentColor="bg-rose-600"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} required />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleFields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className={labelSmCls}>{label} (cm)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className={inputCls}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>

        {!quick && (
          <div>
            <label className={labelSmCls}>Notes</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} placeholder="optional" />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving…' : 'Save measurements'}
        </button>
      </form>

      {saved && (
        <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
          Saved ✓
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-pens-crimson/10 border border-pens-crimson/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
