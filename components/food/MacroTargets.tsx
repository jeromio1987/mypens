'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Target } from 'lucide-react'
import { DEFAULT_TARGETS, type DailyTargets } from '@/lib/foodModels'

const STORAGE_KEY = 'pens_macro_targets'

export function loadTargets(): DailyTargets {
  if (typeof window === 'undefined') return DEFAULT_TARGETS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TARGETS
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      kcal: Number(parsed.kcal) || DEFAULT_TARGETS.kcal,
      proteinG: Number(parsed.proteinG) || DEFAULT_TARGETS.proteinG,
      carbsG: Number(parsed.carbsG) || DEFAULT_TARGETS.carbsG,
      fatG: Number(parsed.fatG) || DEFAULT_TARGETS.fatG,
    }
  } catch {
    return DEFAULT_TARGETS
  }
}

function saveTargets(t: DailyTargets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
}

interface Props {
  onTargetsChange: (t: DailyTargets) => void
}

const inputCls =
  'w-full bg-pens-navy border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream focus:outline-none focus:border-pens-cream/30'

export default function MacroTargets({ onTargetsChange }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DailyTargets>(DEFAULT_TARGETS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const t = loadTargets()
    setForm(t)
    onTargetsChange(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: keyof DailyTargets, v: string) => {
    setForm(f => ({ ...f, [k]: Number(v) || 0 }))
    setSaved(false)
  }

  const handleSave = () => {
    saveTargets(form)
    onTargetsChange(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setForm(DEFAULT_TARGETS)
    saveTargets(DEFAULT_TARGETS)
    onTargetsChange(DEFAULT_TARGETS)
    setSaved(false)
  }

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-pens-navy/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Target size={16} className="text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold text-pens-cream shrink-0">Daily targets</span>
          <span className="text-xs text-pens-cream/40 truncate">
            {form.kcal} kcal · {form.proteinG}g P · {form.carbsG}g C · {form.fatG}g F
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-pens-cream/40 shrink-0" /> : <ChevronDown size={16} className="text-pens-cream/40 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-pens-muted/20">
          <p className="text-xs text-pens-cream/40 mt-3 mb-4">
            Saved locally — progress bars in the food log update instantly.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { key: 'kcal', label: 'Calories', unit: 'kcal', step: 50, min: 500 },
                { key: 'proteinG', label: 'Protein', unit: 'g', step: 5, min: 10 },
                { key: 'carbsG', label: 'Carbs', unit: 'g', step: 10, min: 0 },
                { key: 'fatG', label: 'Fat', unit: 'g', step: 5, min: 0 },
              ] as const
            ).map(({ key, label, unit, step, min }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-pens-cream/60 mb-1">
                  {label} <span className="text-pens-cream/40">({unit})</span>
                </label>
                <input
                  type="number"
                  min={min}
                  step={step}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {saved ? 'Saved ✓' : 'Save targets'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-pens-cream/40 hover:text-pens-cream/70 px-3 py-2 rounded-lg hover:bg-pens-navy/40 transition-colors"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
