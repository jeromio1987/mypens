'use client'

import { useState } from 'react'
import QuickToggle from '@/components/shared/QuickToggle'
import PresetPicker from '@/components/shared/PresetPicker'

interface Props {
  date: string
  onSaved?: () => void
}

const BLANK = { exercise: '', sets: '', reps: '', weightKg: '', rpe: '', notes: '' }

export default function TrainingEntry({ date, onSaved }: Props) {
  const [quick, setQuick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ exercise: string; volume: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (data: Record<string, unknown>) => {
    setForm(f => ({
      ...f,
      ...(data.exercise != null ? { exercise: String(data.exercise) } : {}),
      ...(data.sets != null ? { sets: String(data.sets) } : {}),
      ...(data.reps != null ? { reps: String(data.reps) } : {}),
      ...(data.weightKg != null ? { weightKg: String(data.weightKg) } : {}),
      ...(data.rpe != null ? { rpe: String(data.rpe) } : {}),
    }))
  }

  const previewVolume =
    form.sets && form.reps && form.weightKg
      ? (parseFloat(form.sets) * parseFloat(form.reps) * parseFloat(form.weightKg)).toFixed(0)
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const res = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          exercise: form.exercise,
          sets: parseInt(form.sets),
          reps: parseInt(form.reps),
          weightKg: form.weightKg ? parseFloat(form.weightKg) : 0,
          rpe: form.rpe ? parseInt(form.rpe) : undefined,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved({ exercise: data.exercise, volume: data.volume })
      setForm(BLANK)
      onSaved?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const presetValues = form.exercise
    ? { exercise: form.exercise, sets: form.sets, reps: form.reps, weightKg: form.weightKg, ...(form.rpe ? { rpe: form.rpe } : {}) }
    : undefined

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold">Log Exercise</h2>
        <QuickToggle quick={quick} onChange={setQuick} />
      </div>

      <div className="mb-4">
        <PresetPicker
          module="training"
          onApply={applyPreset}
          currentValues={presetValues}
          accentColor="bg-orange-500"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Exercise <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.exercise}
            onChange={e => set('exercise', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Back squat, Bench press, Pull-up…"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Sets <span className="text-red-400">*</span>
            </label>
            <input
              type="number" min="1"
              value={form.sets}
              onChange={e => set('sets', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="3"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Reps <span className="text-red-400">*</span>
            </label>
            <input
              type="number" min="1"
              value={form.reps}
              onChange={e => set('reps', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="8"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Weight (kg)</label>
            <input
              type="number" step="0.5" min="0"
              value={form.weightKg}
              onChange={e => set('weightKg', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="80"
            />
          </div>
        </div>

        {previewVolume && (
          <p className="text-xs text-orange-500">
            Volume: <strong>{previewVolume} kg</strong> ({form.sets}×{form.reps}×{form.weightKg})
          </p>
        )}

        {/* Detailed only: RPE + notes */}
        {!quick && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">RPE (1–10)</label>
              <input
                type="number" min="1" max="10"
                value={form.rpe}
                onChange={e => set('rpe', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="7"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Paused reps…"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving…' : quick ? 'Quick add' : 'Add set'}
        </button>
      </form>

      {saved && (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm">
          <p className="font-semibold text-orange-800">Saved ✓</p>
          <p className="text-orange-600 mt-1">
            <strong>{saved.exercise}</strong> — volume{' '}
            <strong>{saved.volume > 0 ? `${saved.volume} kg` : 'bodyweight'}</strong>
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
