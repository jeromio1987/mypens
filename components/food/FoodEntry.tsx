'use client'

import { useState } from 'react'
import { MEAL_LABELS, MEAL_ORDER, type MealType } from '@/lib/foodModels'
import QuickToggle from '@/components/shared/QuickToggle'
import PresetPicker from '@/components/shared/PresetPicker'

interface Props {
  date: string
  onSaved?: () => void
}

const DEFAULTS = {
  meal: 'snack' as MealType,
  name: '',
  kcal: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
  notes: '',
}

export default function FoodEntry({ date, onSaved }: Props) {
  const [quick, setQuick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULTS)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (data: Record<string, unknown>) => {
    setForm(f => ({
      ...f,
      ...(data.meal ? { meal: String(data.meal) as MealType } : {}),
      ...(data.name ? { name: String(data.name) } : {}),
      ...(data.kcal != null ? { kcal: String(data.kcal) } : {}),
      ...(data.proteinG != null ? { proteinG: String(data.proteinG) } : {}),
      ...(data.carbsG != null ? { carbsG: String(data.carbsG) } : {}),
      ...(data.fatG != null ? { fatG: String(data.fatG) } : {}),
      ...(data.fiberG != null ? { fiberG: String(data.fiberG) } : {}),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        date,
        meal: form.meal,
        name: form.name,
        kcal: form.kcal ? parseFloat(form.kcal) : 0,
        proteinG: form.proteinG ? parseFloat(form.proteinG) : 0,
        carbsG: form.carbsG ? parseFloat(form.carbsG) : 0,
        fatG: form.fatG ? parseFloat(form.fatG) : 0,
        fiberG: form.fiberG ? parseFloat(form.fiberG) : 0,
        notes: form.notes || undefined,
      }
      const res = await fetch('/api/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setForm(f => ({ ...f, name: '', kcal: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', notes: '' }))
      onSaved?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  // For saving as preset: capture name + macros (exclude date)
  const presetValues = form.name
    ? { meal: form.meal, name: form.name, kcal: form.kcal, proteinG: form.proteinG, carbsG: form.carbsG, fatG: form.fatG, fiberG: form.fiberG }
    : undefined

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold">Log Food</h2>
        <QuickToggle quick={quick} onChange={setQuick} />
      </div>

      <div className="mb-4">
        <PresetPicker
          module="food"
          onApply={applyPreset}
          currentValues={presetValues}
          accentColor="bg-emerald-600"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Meal selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Meal</label>
          <div className="flex gap-2 flex-wrap">
            {MEAL_ORDER.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setForm(f => ({ ...f, meal: m }))}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  form.meal === m
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Food name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Food / item <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Chicken breast 150g"
            required
          />
        </div>

        {/* Quick mode: just kcal | Detailed: full macros */}
        {quick ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">kcal</label>
              <input
                type="number" step="1" min="0"
                value={form.kcal}
                onChange={e => set('kcal', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="250"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Protein (g)</label>
              <input
                type="number" step="0.5" min="0"
                value={form.proteinG}
                onChange={e => set('proteinG', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="30"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { key: 'kcal', label: 'kcal', placeholder: '250', step: '1' },
                { key: 'proteinG', label: 'Protein (g)', placeholder: '30', step: '0.5' },
                { key: 'carbsG', label: 'Carbs (g)', placeholder: '0', step: '0.5' },
                { key: 'fatG', label: 'Fat (g)', placeholder: '5', step: '0.5' },
              ].map(({ key, label, placeholder, step }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="number" step={step} min="0"
                    value={(form as Record<string, string>)[key]}
                    onChange={e => set(key, e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fiber (g)</label>
                <input
                  type="number" step="0.5" min="0"
                  value={form.fiberG}
                  onChange={e => set('fiberG', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="optional"
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Adding…' : quick ? 'Quick add' : 'Add item'}
        </button>
      </form>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
