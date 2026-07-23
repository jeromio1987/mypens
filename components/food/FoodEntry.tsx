'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera } from 'lucide-react'
import { MEAL_LABELS, MEAL_ORDER, type MealType } from '@/lib/foodModels'
import QuickToggle from '@/components/shared/QuickToggle'
import PresetPicker from '@/components/shared/PresetPicker'
import { defaultEatenGrams, scalePortion } from '@/lib/foodPortion'

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
  brand: string | null
  packGrams: number | null
  assumedGrams: number | null
  portionGrams: number | null
}

function mapScanItems(items: unknown[], fallbackMeal: MealType): ScanItem[] {
  return items
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map(x => ({
      name: String(x.name ?? ''),
      meal: MEAL_ORDER.includes(x.meal as MealType) ? (x.meal as MealType) : fallbackMeal,
      kcal: Math.max(0, Number(x.kcal) || 0),
      proteinG: Math.max(0, Number(x.proteinG) || 0),
      carbsG: Math.max(0, Number(x.carbsG) || 0),
      fatG: Math.max(0, Number(x.fatG) || 0),
      fiberG: Math.max(0, Number(x.fiberG) || 0),
      brand: typeof x.brand === 'string' && x.brand.trim() ? x.brand.trim() : null,
      packGrams: Number(x.packGrams) > 0 ? Number(x.packGrams) : null,
      assumedGrams: Number(x.assumedGrams) > 0 ? Number(x.assumedGrams) : null,
      portionGrams: Number(x.portionGrams) > 0 ? Number(x.portionGrams) : null,
    }))
    .filter(x => x.name.trim().length > 0)
}

interface FoodSuggestion {
  id: string
  name: string
  meal: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
}

interface RotationPreset {
  id: string
  name: string
  data: string
  usedCount: number
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
  const [rotationPresets, setRotationPresets] = useState<RotationPreset[]>([])
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [refining, setRefining] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [dishSummary, setDishSummary] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<string | null>(null)
  const [scanItems, setScanItems] = useState<ScanItem[]>([])
  /** Grams the user intends to eat for each scan row (parallel to scanItems). */
  const [eatenGrams, setEatenGrams] = useState<number[]>([])
  const [loggingBatch, setLoggingBatch] = useState(false)
  const [anthropicFileId, setAnthropicFileId] = useState<string | null>(null)
  const [priorJson, setPriorJson] = useState<string | null>(null)
  const [refineText, setRefineText] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const commitScan = (cleaned: ScanItem[], meta?: { dishSummary?: string | null; analysisMode?: string | null }) => {
    setScanItems(cleaned)
    setEatenGrams(cleaned.map(defaultEatenGrams))
    if (meta?.dishSummary !== undefined) setDishSummary(meta.dishSummary)
    if (meta?.analysisMode !== undefined) setAnalysisMode(meta.analysisMode)
  }

  const scaledAt = (i: number) => {
    const item = scanItems[i]
    if (!item) return null
    return scalePortion(item, eatenGrams[i] ?? defaultEatenGrams(item))
  }

  useEffect(() => {
    fetch('/api/presets?module=food')
      .then(r => r.json())
      .then((data: RotationPreset[]) => setRotationPresets(data.slice(0, 6)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (form.name.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(() => {
      fetch(`/api/food?search=${encodeURIComponent(form.name)}`)
        .then(r => r.ok ? r.json() : [])
        .then((data: FoodSuggestion[]) => setSuggestions(data))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [form.name])

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

  const applyRotationPreset = (preset: RotationPreset) => {
    try {
      const data = JSON.parse(preset.data) as Record<string, unknown>
      applyPreset(data)
      fetch('/api/presets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: preset.id }) })
      setRotationPresets(p => p.map(x => x.id === preset.id ? { ...x, usedCount: x.usedCount + 1 } : x))
    } catch {}
  }

  const applySuggestion = (s: FoodSuggestion) => {
    setForm(f => ({
      ...f,
      name: s.name,
      kcal: s.kcal ? String(Math.round(s.kcal)) : '',
      proteinG: s.proteinG ? String(s.proteinG) : '',
      carbsG: s.carbsG ? String(s.carbsG) : '',
      fatG: s.fatG ? String(s.fatG) : '',
      fiberG: s.fiberG ? String(s.fiberG) : '',
    }))
    setSuggestions([])
    setShowSuggestions(false)
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
    setEatenGrams([])
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
      const cleaned = mapScanItems(Array.isArray(data.items) ? data.items : [], form.meal)
      const dish = typeof data.dishSummary === 'string' ? data.dishSummary : null
      const mode = typeof data.analysisMode === 'string' ? data.analysisMode : null
      commitScan(cleaned, { dishSummary: dish, analysisMode: mode })
      const fid = data.anthropicFileId != null ? String(data.anthropicFileId) : ''
      setAnthropicFileId(fid.length > 0 ? fid : null)
      setPriorJson(JSON.stringify({
        analysisMode: data.analysisMode ?? 'meal_estimate',
        dishSummary: data.dishSummary ?? '',
        items: cleaned,
      }))
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
      const cleaned = mapScanItems(Array.isArray(data.items) ? data.items : [], form.meal)
      commitScan(cleaned, {
        dishSummary: typeof data.dishSummary === 'string' ? data.dishSummary : null,
        analysisMode: typeof data.analysisMode === 'string' ? data.analysisMode : null,
      })
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

  const applyScanToForm = (index: number) => {
    const scaled = scaledAt(index)
    if (!scaled) return
    const g = scaled.eatenGrams
    const label =
      g > 0
        ? `${scaled.brand ? `${scaled.brand} · ` : ''}${scaled.name} (${Math.round(g)}g)`
        : scaled.name
    setForm(f => ({
      ...f,
      meal: scaled.meal,
      name: label,
      kcal: scaled.kcal ? String(Math.round(scaled.kcal)) : '',
      proteinG: scaled.proteinG ? String(scaled.proteinG) : '',
      carbsG: scaled.carbsG ? String(scaled.carbsG) : '',
      fatG: scaled.fatG ? String(scaled.fatG) : '',
      fiberG: scaled.fiberG ? String(scaled.fiberG) : '',
      notes: scaled.packGrams
        ? `Pack ${scaled.packGrams}g · ate ${Math.round(g)}g`
        : f.notes,
    }))
    setPhotoError(null)
  }

  const logAllScan = async () => {
    if (scanItems.length === 0) return
    setLoggingBatch(true)
    setPhotoError(null)
    try {
      for (let i = 0; i < scanItems.length; i++) {
        const scaled = scaledAt(i)
        if (!scaled) continue
        const g = scaled.eatenGrams
        const name =
          g > 0
            ? `${scaled.brand ? `${scaled.brand} · ` : ''}${scaled.name} (${Math.round(g)}g)`
            : scaled.name
        const res = await fetch('/api/food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            meal: scaled.meal,
            name,
            kcal: scaled.kcal,
            proteinG: scaled.proteinG,
            carbsG: scaled.carbsG,
            fatG: scaled.fatG,
            fiberG: scaled.fiberG,
            notes:
              i === 0 && dishSummary
                ? `AI: ${dishSummary.slice(0, 160)}${scaled.packGrams ? ` · pack ${scaled.packGrams}g / ate ${Math.round(g)}g` : ''}`
                : scaled.packGrams
                  ? `Pack ${scaled.packGrams}g · ate ${Math.round(g)}g`
                  : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Save failed')
      }
      setScanItems([])
      setEatenGrams([])
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

      {rotationPresets.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wide text-pens-cream/35 mb-2">My Rotation</p>
          <div className="flex flex-wrap gap-1.5">
            {rotationPresets.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyRotationPreset(preset)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-pens-navy border border-pens-muted/40 text-pens-cream/80 hover:border-emerald-500/50 hover:text-pens-cream transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <ul className="space-y-3">
                {scanItems.map((item, i) => {
                  const scaled = scaledAt(i)!
                  const eaten = eatenGrams[i] ?? defaultEatenGrams(item)
                  const maxG = Math.max(item.packGrams || 0, item.assumedGrams || 0, eaten, 100)
                  return (
                    <li
                      key={`${item.name}-${i}`}
                      className="space-y-2 border border-pens-muted/20 rounded-lg px-3 py-3 bg-pens-deep/40"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-pens-cream truncate">
                            {item.brand ? `${item.brand} · ` : ''}
                            {item.name}
                          </p>
                          <p className="text-xs text-pens-cream/45">
                            {MEAL_LABELS[item.meal]}
                            {item.packGrams ? ` · pack ${item.packGrams}g` : ''}
                            {item.assumedGrams ? ` · macros for ${item.assumedGrams}g` : ''}
                          </p>
                          <p className="text-xs text-emerald-300/80 mt-0.5">
                            {Math.round(scaled.kcal)} kcal · P {scaled.proteinG}g · C {scaled.carbsG}g · F{' '}
                            {scaled.fatG}g
                            {scaled.scale !== 1 ? ` · ×${scaled.scale}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => applyScanToForm(i)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600/90 text-white hover:bg-emerald-600 shrink-0"
                        >
                          Fill form
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs text-pens-cream/55">How much are you eating?</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={Math.max(maxG * 2, 5000)}
                              step={1}
                              value={Math.round(eaten)}
                              onChange={e => {
                                const v = Math.max(0, Number(e.target.value) || 0)
                                setEatenGrams(prev => {
                                  const next = [...prev]
                                  next[i] = v
                                  return next
                                })
                              }}
                              className="w-20 bg-pens-navy border border-pens-muted/40 rounded-md px-2 py-1 text-sm text-pens-cream text-right"
                            />
                            <span className="text-xs text-pens-cream/45">g</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={Math.max(item.packGrams || maxG, 1)}
                          step={1}
                          value={Math.min(eaten, Math.max(item.packGrams || maxG, 1))}
                          onChange={e => {
                            const v = Number(e.target.value)
                            setEatenGrams(prev => {
                              const next = [...prev]
                              next[i] = v
                              return next
                            })
                          }}
                          className="w-full accent-emerald-500"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {item.packGrams != null && (
                            <>
                              <button
                                type="button"
                                className="text-[10px] px-2 py-0.5 rounded-full border border-pens-muted/40 text-pens-cream/70 hover:border-emerald-500/50"
                                onClick={() =>
                                  setEatenGrams(prev => {
                                    const next = [...prev]
                                    next[i] = item.packGrams!
                                    return next
                                  })
                                }
                              >
                                Whole pack ({item.packGrams}g)
                              </button>
                              <button
                                type="button"
                                className="text-[10px] px-2 py-0.5 rounded-full border border-pens-muted/40 text-pens-cream/70 hover:border-emerald-500/50"
                                onClick={() =>
                                  setEatenGrams(prev => {
                                    const next = [...prev]
                                    next[i] = Math.round(item.packGrams! / 2)
                                    return next
                                  })
                                }
                              >
                                Half
                              </button>
                            </>
                          )}
                          {item.assumedGrams != null && item.assumedGrams !== item.packGrams && (
                            <button
                              type="button"
                              className="text-[10px] px-2 py-0.5 rounded-full border border-pens-muted/40 text-pens-cream/70 hover:border-emerald-500/50"
                              onClick={() =>
                                setEatenGrams(prev => {
                                  const next = [...prev]
                                  next[i] = item.assumedGrams!
                                  return next
                                })
                              }
                            >
                              Label serving ({item.assumedGrams}g)
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                disabled={loggingBatch}
                onClick={() => void logAllScan()}
                className="w-full text-sm font-medium py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {loggingBatch
                  ? 'Logging…'
                  : `Log all ${scanItems.length} item${scanItems.length === 1 ? '' : 's'} at chosen grams`}
              </button>
              {anthropicFileId && priorJson && (
                <div className="pt-3 mt-2 border-t border-pens-muted/25 space-y-2">
                  <label className="block text-xs font-medium text-pens-cream/50">Refine with same photo</label>
                  <input
                    type="text"
                    value={refineText}
                    onChange={e => setRefineText(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Delhaize yoghurt — I ate 200g of the 1kg tub"
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

        <div className="relative">
          <label className={labelCls}>
            Food / item <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => { set('name', e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className={inputCls}
            placeholder="e.g. Chicken breast 150g"
            required
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 rounded-xl border border-pens-muted/40 bg-pens-surface shadow-lg overflow-hidden">
              {suggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => applySuggestion(s)}
                  className="w-full text-left px-3 py-2 hover:bg-pens-deep/60 transition-colors border-b border-pens-muted/20 last:border-0"
                >
                  <p className="text-sm text-pens-cream truncate">{s.name}</p>
                  <p className="text-xs text-pens-cream/45">{Math.round(s.kcal)} kcal · P {s.proteinG}g · C {s.carbsG}g · F {s.fatG}g</p>
                </button>
              ))}
            </div>
          )}
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
