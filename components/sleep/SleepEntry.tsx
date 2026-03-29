'use client'

import { useState } from 'react'
import QuickToggle from '@/components/shared/QuickToggle'
import PresetPicker from '@/components/shared/PresetPicker'

interface Props {
  date: string
  onSaved?: () => void
}

const QUALITY_LABELS: Record<number, string> = {
  1: '😴 Very poor',
  2: '😑 Poor',
  3: '😐 Fair',
  4: '😊 Good',
  5: '🌟 Excellent',
}

const inputCls = 'w-full bg-pens-navy border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream focus:outline-none focus:border-pens-cream/30'
const labelCls = 'block text-sm font-medium text-pens-cream/80 mb-1'

export default function SleepEntry({ date, onSaved }: Props) {
  const [quick, setQuick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ hours: number; quality: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    bedtime: '22:30',
    wakeTime: '06:30',
    quality: 3,
    hrv: '',
    notes: '',
  })

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (data: Record<string, unknown>) => {
    setForm(f => ({
      ...f,
      ...(data.bedtime ? { bedtime: String(data.bedtime) } : {}),
      ...(data.wakeTime ? { wakeTime: String(data.wakeTime) } : {}),
      ...(data.quality != null ? { quality: Number(data.quality) } : {}),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const res = await fetch('/api/sleep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          bedtime: form.bedtime,
          wakeTime: form.wakeTime,
          quality: form.quality,
          hrv: form.hrv ? parseFloat(form.hrv) : undefined,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved({ hours: data.hours, quality: form.quality })
      onSaved?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold text-pens-cream">Log Sleep</h2>
        <QuickToggle quick={quick} onChange={setQuick} />
      </div>

      <div className="mb-4">
        <PresetPicker
          module="sleep"
          onApply={applyPreset}
          currentValues={{ bedtime: form.bedtime, wakeTime: form.wakeTime, quality: form.quality }}
          accentColor="bg-violet-600"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Bedtime</label>
            <input type="time" value={form.bedtime} onChange={e => set('bedtime', e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Wake time</label>
            <input type="time" value={form.wakeTime} onChange={e => set('wakeTime', e.target.value)} className={inputCls} required />
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Quality — <span className="text-violet-400">{QUALITY_LABELS[form.quality]}</span>
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(q => (
              <button
                key={q}
                type="button"
                onClick={() => set('quality', q)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.quality === q
                    ? 'bg-violet-600 text-white'
                    : 'bg-pens-navy/60 text-pens-cream/50 hover:bg-pens-navy hover:text-pens-cream'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {!quick && (
          <>
            <div>
              <label className={labelCls}>HRV <span className="text-pens-cream/40 font-normal">(ms, optional)</span></label>
              <input type="number" step="1" min="0" value={form.hrv} onChange={e => set('hrv', e.target.value)} className={inputCls} placeholder="e.g. 58" />
            </div>
            <div>
              <label className={labelCls}>Notes <span className="text-pens-cream/40 font-normal">(optional)</span></label>
              <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} placeholder="Woke up twice, vivid dreams…" />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving…' : quick ? 'Quick save' : 'Save sleep entry'}
        </button>
      </form>

      {saved && (
        <div className="mt-4 p-4 bg-violet-900/20 border border-violet-500/20 rounded-xl text-sm">
          <p className="font-semibold text-violet-400">Saved ✓</p>
          <p className="text-violet-300 mt-1">
            <strong>{saved.hours}h</strong> — {QUALITY_LABELS[saved.quality]}
          </p>
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
