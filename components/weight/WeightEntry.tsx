'use client'

import { useState } from 'react'
import { Scale, Dumbbell, Activity } from 'lucide-react'
import QuickToggle from '@/components/shared/QuickToggle'
import PresetPicker from '@/components/shared/PresetPicker'

interface WeightBreakdown {
  scaleKg: number
  creatineKg: number
  alcoholKg: number
  glycogenKg: number
  sodiumKg: number
  hardTrainingKg: number
  trueWeightKg: number
  tanitaReliable: boolean
  tanitaFlags: string[]
  confidence: 'high' | 'medium' | 'low'
  activeConfounders: number
}

const CONF_STYLES = {
  high:   { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'High confidence', sub: 'No confounders — reading is clean' },
  medium: { badge: 'bg-amber-50 text-amber-700 border border-amber-200',       label: 'Medium confidence', sub: 'Minor factors logged — small uncertainty' },
  low:    { badge: 'bg-red-50 text-red-600 border border-red-200',             label: 'Low confidence', sub: 'Multiple confounders — adjusted weight is approximate' },
}

interface EntryResult {
  entry: Record<string, unknown>
  breakdown: WeightBreakdown
}

export default function WeightEntry({ onSaved }: { onSaved?: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [quick, setQuick] = useState(true)
  const [activeTab, setActiveTab] = useState<'scale' | 'context' | 'tanita'>('scale')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<EntryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    date: today,
    scaleKg: '',
    bodyFatPct: '',
    muscleMassKg: '',
    boneMassKg: '',
    bodyWaterPct: '',
    visceralFat: '',
    creatineDoseG: '0',
    creatineDaysOn: '0',
    creatinePostLoad: false,
    alcoholUnits: '0',
    hoursSinceAlcohol: '48',
    carbsG: '0',
    hardTraining: false,
    morningReading: true,
    highSodium: false,
    restaurantMeal: false,
    flightDay: false,
    illnessDay: false,
  })

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (data: Record<string, unknown>) => {
    setForm(f => ({
      ...f,
      ...(data.creatineDoseG != null ? { creatineDoseG: String(data.creatineDoseG) } : {}),
      ...(data.creatineDaysOn != null ? { creatineDaysOn: String(data.creatineDaysOn) } : {}),
      ...(data.hardTraining != null ? { hardTraining: Boolean(data.hardTraining) } : {}),
      ...(data.morningReading != null ? { morningReading: Boolean(data.morningReading) } : {}),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        date: form.date,
        scaleKg: parseFloat(form.scaleKg),
        bodyFatPct: form.bodyFatPct ? parseFloat(form.bodyFatPct) : undefined,
        muscleMassKg: form.muscleMassKg ? parseFloat(form.muscleMassKg) : undefined,
        boneMassKg: form.boneMassKg ? parseFloat(form.boneMassKg) : undefined,
        bodyWaterPct: form.bodyWaterPct ? parseFloat(form.bodyWaterPct) : undefined,
        visceralFat: form.visceralFat ? parseInt(form.visceralFat) : undefined,
        creatineDoseG: parseFloat(form.creatineDoseG),
        creatineDaysOn: parseInt(form.creatineDaysOn),
        creatinePostLoad: form.creatinePostLoad,
        alcoholUnits: parseFloat(form.alcoholUnits),
        hoursSinceAlcohol: parseFloat(form.hoursSinceAlcohol),
        carbsG: parseFloat(form.carbsG),
        hardTraining: form.hardTraining,
        morningReading: form.morningReading,
        highSodium: form.highSodium,
        restaurantMeal: form.restaurantMeal,
        flightDay: form.flightDay,
        illnessDay: form.illnessDay,
      }
      const res = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setResult(data)
      onSaved?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'scale' as const, label: 'Scale', icon: Scale },
    { id: 'context' as const, label: 'Context', icon: Dumbbell },
    { id: 'tanita' as const, label: 'Tanita', icon: Activity },
  ]

  return (
    <div className="bg-white rounded-2xl shadow p-6 max-w-lg w-full">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold">Log Weight</h2>
        <QuickToggle quick={quick} onChange={v => { setQuick(v); if (v) setActiveTab('scale') }} />
      </div>

      <div className="mb-4">
        <PresetPicker
          module="weight"
          onApply={applyPreset}
          currentValues={{ creatineDoseG: form.creatineDoseG, creatineDaysOn: form.creatineDaysOn, hardTraining: form.hardTraining, morningReading: form.morningReading }}
          accentColor="bg-blue-600"
        />
      </div>

      {/* Tabs — hidden in quick mode */}
      {!quick && (
        <div className="flex gap-2 mb-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Quick mode: just date + scale weight */}
        {quick && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scale weight (kg) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.05"
                value={form.scaleKg}
                onChange={e => set('scaleKg', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. 82.4"
                required
              />
            </div>
          </div>
        )}

        {/* Scale Tab */}
        {!quick && activeTab === 'scale' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scale weight (kg) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.05"
                value={form.scaleKg}
                onChange={e => set('scaleKg', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. 82.4"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'bodyFatPct', label: 'Body fat %', placeholder: '18.5' },
                { key: 'muscleMassKg', label: 'Muscle mass kg', placeholder: '62.0' },
                { key: 'boneMassKg', label: 'Bone mass kg', placeholder: '3.2' },
                { key: 'bodyWaterPct', label: 'Body water %', placeholder: '55.0' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={(form as unknown as Record<string, string>)[key]}
                    onChange={e => set(key, e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Visceral fat</label>
                <input
                  type="number"
                  value={form.visceralFat}
                  onChange={e => set('visceralFat', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="5"
                />
              </div>
            </div>
          </div>
        )}

        {/* Context Tab */}
        {!quick && activeTab === 'context' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">These inputs drive the water retention model.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Creatine dose (g/day)
                </label>
                <input
                  type="number"
                  step="1"
                  value={form.creatineDoseG}
                  onChange={e => set('creatineDoseG', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Days on creatine
                </label>
                <input
                  type="number"
                  value={form.creatineDaysOn}
                  onChange={e => set('creatineDaysOn', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {Number(form.creatineDoseG) > 0 && Number(form.creatineDoseG) < 10 && (
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.creatinePostLoad}
                      onChange={e => set('creatinePostLoad', e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium">Post-load maintenance</p>
                      <p className="text-xs text-gray-400">Switched from loading (≥10g) — stores stay fully saturated</p>
                    </div>
                  </label>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Alcohol units
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.alcoholUnits}
                  onChange={e => set('alcoholUnits', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Hours since alcohol
                </label>
                <input
                  type="number"
                  step="1"
                  value={form.hoursSinceAlcohol}
                  onChange={e => set('hoursSinceAlcohol', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Carbs yesterday (g)
                </label>
                <input
                  type="number"
                  step="10"
                  value={form.carbsG}
                  onChange={e => set('carbsG', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Phase 5 confounders */}
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-400">Additional confounders (affect confidence score)</p>
              {[
                { key: 'highSodium', label: 'High sodium day', sub: 'Salty meals → water retention' },
                { key: 'restaurantMeal', label: 'Restaurant meal(s)', sub: 'Hidden sodium / large portions' },
                { key: 'flightDay', label: 'Flight / sedentary day', sub: 'Fluid pooling in lower body' },
                { key: 'illnessDay', label: 'Illness / inflammation', sub: 'Scale and Tanita both unreliable' },
              ].map(({ key, label, sub }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={e => set(key, e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Tanita Tab */}
        {!quick && activeTab === 'tanita' && (
          <div className="space-y-5">
            <p className="text-xs text-gray-400">
              Tanita BIA readings are affected by hydration, training, and timing. Check what
              applies.
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hardTraining}
                onChange={e => set('hardTraining', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium">Hard training yesterday</p>
                <p className="text-xs text-gray-400">Muscle inflammation temporarily raises water</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.morningReading}
                onChange={e => set('morningReading', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium">Morning reading</p>
                <p className="text-xs text-gray-400">Fasted, post-toilet — most accurate</p>
              </div>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving…' : quick ? 'Quick save' : 'Save entry'}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-green-800">Saved ✓</p>
            {result.breakdown.confidence && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONF_STYLES[result.breakdown.confidence].badge}`}>
                {CONF_STYLES[result.breakdown.confidence].label}
              </span>
            )}
          </div>
          {result.breakdown.confidence && (
            <p className="text-xs text-gray-500">{CONF_STYLES[result.breakdown.confidence].sub}
              {result.breakdown.activeConfounders > 0 && ` · ${result.breakdown.activeConfounders} active factor${result.breakdown.activeConfounders > 1 ? 's' : ''}`}
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-4 text-green-700 text-xs">
            <span>Scale: <strong>{result.breakdown.scaleKg} kg</strong></span>
            <span>Adjusted: <strong>{result.breakdown.trueWeightKg} kg</strong></span>
            {result.breakdown.creatineKg > 0 && <span>Creatine: −{result.breakdown.creatineKg} kg</span>}
            {result.breakdown.alcoholKg > 0 && <span>Alcohol: −{result.breakdown.alcoholKg} kg</span>}
            {result.breakdown.glycogenKg > 0 && <span>Glycogen: −{result.breakdown.glycogenKg} kg</span>}
            {result.breakdown.sodiumKg > 0 && <span>Sodium: −{result.breakdown.sodiumKg} kg</span>}
            {result.breakdown.hardTrainingKg > 0 && <span>Training: −{result.breakdown.hardTrainingKg} kg</span>}
          </div>
          {!result.breakdown.tanitaReliable && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-700 font-medium text-xs">⚠ Tanita reading may be unreliable</p>
              {result.breakdown.tanitaFlags.map((f, i) => (
                <p key={i} className="text-amber-600 text-xs mt-0.5">• {f}</p>
              ))}
            </div>
          )}
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
