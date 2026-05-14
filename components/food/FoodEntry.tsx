'use client'

import { useState, useRef } from 'react'
import { Camera } from 'lucide-react'
import { MEAL_LABELS, MEAL_ORDER, type MealType } from '@/lib/foodModels'
import QuickToggle from '@/components/shared/QuickToggle'
import PresetPicker from '@/components/shared/PresetPicker'

interface Props {
  date: string
  onSaved?: () => void
}

interface ScanItem {
  name: string
  meal: MealType
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
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

const inputCls =
  'w-full bg-pens-navy border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream placeholder:text-pens-cream/30 focus:outline-none focus:border-pens-cream/30'
const labelCls = 'block text-sm font-medium text-pens-cream/80 mb-1'

export default function FoodEntry({ date, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [quick, setQuick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULTS)

  const [analyzing, setAnalyzing] = useState(false)
  const [refining, setRefining] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [dishSummary, setDishSummary] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<string | null>(null)
  const [scanItems, setScanItems] = useState<ScanItem[]>([])
  const [loggingBatch, setLoggingBatch] = useState(false)
  const [anthropicFileId, setAnthropicFileId] = useState<string | null>(null)
  const [priorJson, setPriorJson] = useState<string | null>(null)
  const [refineText, setRefineText] = useState('')

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

  const onPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAnalyzing(true)
    setPhotoError(null)
    setDishSummary(null)
    setAnalysisMode(null)
    setScanItems([])
    setAnthropicFileId(null)
    setPriorJson(null)
    setRefineText('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('date', date)
      fd.append('meal', form.meal)
      const res = await fetch('/api/food/photo-analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Photo scan failed')
      const items = Array.isArray(data.items) ? data.items : []
      const cleaned: ScanItem[] = items
        .filter((x: unknown) => x && typeof x === 'object')
        .map((x: Record<string, unknown>) => ({
          name: String(x.name ?? ''),
          meal: MEAL_ORDER.includes(x.meal as MealType) ? (x.meal as MealType) : form.meal,
          kcal: Math.max(0, Number(x.kcal) || 0),
          proteinG: Math.max(0, Number(x.proteinG) || 0),
          carbsG: Math.max(0, Number(x.carbsG) || 0),
          fatG: Math.max(0, Number(x.fatG) || 0),
          fiberG: Math.max(0, Number(x.fiberG) || 0),
        }))
        .filter((x: ScanItem) => x.name.trim().length > 0)
      setDishSummary(typeof data.dishSummary === 'string' ? data.dishSummary : null)
      setAnalysisMode(typeof data.analysisMode === 'string' ? data.analysisMode : null)
      const fid = data.anthropicFileId != null ? String(data.anthropicFileId) : ''
      setAnthropicFileId(fid.length > 0 ? fid : null)
      setPriorJson(JSON.stringify({
        analysisMode: data.analysisMode ?? 'meal_estimate',
        dishSummary: data.dishSummary ?? '',
        items: cleaned,
      }))
      setScanItems(cleaned)
      if (cleaned.length === 0 && !data.dishSummary) {
        setPhotoError('No food detected. Try a clearer photo or log manually.')
      }
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Photo scan failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const runRefine = async () => {
    if (!anthropicFileId || !priorJson || !refineText.trim()) return
    setRefining(true)
    setPhotoError(null)
    try {
      const res = await fetch('/api/food/photo-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anthropicFileId,
          date,
          meal: form.meal,
          priorAssistantText: priorJson,
          refine: refineText.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refine failed')
      const items = Array.isArray(data.items) ? data.items : []
      const cleaned: ScanItem[] = items
        .filter((x: unknown) => x && typeof x === 'object')
        .map((x: Record<string, unknown>) => ({
          name: String(x.name ?? ''),
          meal: MEAL_ORDER.includes(x.meal as MealType) ? (x.meal as MealType) : form.meal,
          kcal: Math.max(0, Number(x.kcal) || 0),
          proteinG: Math.max(0, Number(x.proteinG) || 0),
          carbsG: Math.max(0, Number(x.carbsG) || 0),
          fatG: Math.max(0, Number(x.fatG) || 0),
          fiberG: Math.max(0, Number(x.fiberG) || 0),
        }))
        .filter((x: ScanItem) => x.name.trim().length > 0)
      setScanItems(cleaned)
      setDishSummary(typeof data.dishSummary === 'string' ? data.dishSummary : null)
      setAnalysisMode(typeof data.analysisMode === 'string' ? data.analysisMode : null)
      setRefineText('')
      setPriorJson(JSON.stringify({
        analysisMode: data.analysisMode ?? 'meal_estimate',
        dishSummary: data.dishSummary ?? '',
        items: cleaned,
      }))
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Refine failed')
    } finally {
      setRefining(false)
    }
  }

  const applyScanToForm = (item: ScanItem) => {
    setForm(f => ({
      ...f,
      meal: item.meal,
      name: item.name,
      kcal: item.kcal ? String(Math.round(item.kcal)) : '',
      proteinG: item.proteinG ? String(item.proteinG) : '',
      carbsG: item.carbsG ? String(item.carbsG) : '',
      fatG: item.fatG ? String(item.fatG) : '',
      fiberG: item.fiberG ? String(item.fiberG) : '',
    }))
    setPhotoError(null)
  }

  const logAllScan = async () => {
    if (scanItems.length === 0) return
    setLoggingBatch(true)
    setPhotoError(null)
    try {
      for (let i = 0; i < scanItems.length; i++) {
        const item = scanItems[i]
        const res = await fetch('/api/food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            meal: item.meal,
            name: item.name,
            kcal: item.kcal,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
            fiberG: item.fiberG,
            notes: i === 0 && dishSummary ? `AI: ${dishSummary.slice(0, 200)}` : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Save failed')
      }
      setScanItems([])
      setDishSummary(null)
      setAnalysisMode(null)
      setAnthropicFileId(null)
      setPriorJson(null)
      setRefineText('')
      onSaved?.()
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Batch log failed')
    } finally {
      setLoggingBatch(false)
    }
  }

  const presetValues = form.name
    ? { meal: form.meal, name: form.name, kcal: form.kcal, proteinG: form.proteinG, carbsG: form.carbsG, fatG: form.fatG, fiberG: form.fiberG }
    : undefined

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold text-pens-cream">Log food</h2>
        <QuickToggle quick={quick} onChange={setQuick} />
      </div>

      <div className="mb-4">
        <PresetPicker
          module="food"
          onApply={applyPreset}
          currentValues={presetValues}
          accentColor="bg-emerald-600"
          variant="dark"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          className="hidden"
          onChange={onPhotoPick}
        />
        <button
          type="button"
          disabled={analyzing}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-pens-navy border border-pens-muted/40 text-pens-cream hover:border-emerald-500/50 hover:bg-pens-navy/80 disabled:opacity-50 transition-colors"
        >
          <Camera size={16} className="text-emerald-400 shrink-0" />
          {analyzing ? 'Scanning photo…' : 'Photo (AI estimate)'}
        </button>
        <span className="text-xs text-pens-cream/40">Uses your meal slot as a hint · needs ANTHROPIC_API_KEY</span>
      </div>

      {(photoError || dishSummary || scanItems.length > 0 || analysisMode) && (
        <div className="mb-4 rounded-xl border border-pens-muted/30 bg-pens-navy/40 p-3 space-y-2">
          {photoError && (
            <p className="text-sm text-red-400">{photoError}</p>
          )}
          {analysisMode && (
            <p className="text-[11px] uppercase tracking-wide text-pens-cream/45">Mode: {analysisMode}</p>
          )}
          {dishSummary && (
            <p className="text-xs text-pens-cream/60 leading-relaxed">{dishSummary}</p>
          )}
          {scanItems.length > 0 && (
            <>
              <ul className="space-y-2">
                {scanItems.map((item, i) => (
                  <li
                    key={`${item.name}-${i}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm border border-pens-muted/20 rounded-lg px-3 py-2 bg-pens-deep/40"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-pens-cream truncate">{item.name}</p>
                      <p className="text-xs text-pens-cream/45">
                        {MEAL_LABELS[item.meal]} · {Math.round(item.kcal)} kcal · P {item.proteinG}g · C {item.carbsG}g · F {item.fatG}g
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyScanToForm(item)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600/90 text-white hover:bg-emerald-600 shrink-0"
                    >
                      Fill form
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={loggingBatch}
                onClick={() => void logAllScan()}
                className="w-full text-sm font-medium py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {loggingBatch ? 'Logging…' : `Log all ${scanItems.length} item${scanItems.length === 1 ? '' : 's'}`}
              </button>
              {anthropicFileId && priorJson && (
                <div className="pt-3 mt-2 border-t border-pens-muted/25 space-y-2">
                  <label className="block text-xs font-medium text-pens-cream/50">Refine with same photo</label>
                  <input
                    type="text"
                    value={refineText}
                    onChange={e => setRefineText(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. That was salmon, not tuna"
                  />
                  <button
                    type="button"
                    disabled={refining || !refineText.trim()}
                    onClick={() => void runRefine()}
                    className="w-full text-sm font-medium py-2 rounded-lg border border-pens-muted/40 text-pens-cream hover:bg-pens-navy/50 disabled:opacity-40"
                  >
                    {refining ? 'Updating…' : 'Apply correction'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Meal</label>
          <div className="flex gap-2 flex-wrap">
            {MEAL_ORDER.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setForm(f => ({ ...f, meal: m }))}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  form.meal === m
                    ? 'bg-emerald-600 text-white'
                    : 'bg-pens-navy text-pens-cream/60 border border-pens-muted/40 hover:border-pens-muted/60'
                }`}
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Food / item <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className={inputCls}
            placeholder="e.g. Chicken breast 150g"
            required
          />
        </div>

        {quick ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-pens-cream/50 mb-1">kcal</label>
              <input
                type="number"
                step="1"
                min="0"
                value={form.kcal}
                onChange={e => set('kcal', e.target.value)}
                className={inputCls}
                placeholder="250"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pens-cream/50 mb-1">Protein (g)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.proteinG}
                onChange={e => set('proteinG', e.target.value)}
                className={inputCls}
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
                  <label className="block text-xs font-medium text-pens-cream/50 mb-1">{label}</label>
                  <input
                    type="number"
                    step={step}
                    min="0"
                    value={(form as Record<string, string>)[key]}
                    onChange={e => set(key, e.target.value)}
                    className={inputCls}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-pens-cream/50 mb-1">Fiber (g)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.fiberG}
                  onChange={e => set('fiberG', e.target.value)}
                  className={inputCls}
                  placeholder="2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-pens-cream/50 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  className={inputCls}
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
        <div className="mt-3 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
