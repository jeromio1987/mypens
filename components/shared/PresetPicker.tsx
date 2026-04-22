'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bookmark, ChevronDown, Trash2, Plus } from 'lucide-react'

interface Preset {
  id: string
  name: string
  module: string
  data: string
  usedCount: number
}

interface Props {
  module: 'weight' | 'food' | 'sleep' | 'training' | 'measurements'
  onApply: (data: Record<string, unknown>) => void
  /** Current form values — passed in when user wants to save current as preset */
  currentValues?: Record<string, unknown>
  accentColor?: string // tailwind bg class e.g. 'bg-pens-gold'
  /** Visual variant. Defaults to 'dark' to match the dominant pens-* surface theme. */
  variant?: 'dark' | 'light'
}

const THEMES = {
  dark: {
    trigger: 'text-pens-cream/70 hover:text-pens-cream border-pens-muted/40 bg-pens-deep/60 hover:bg-pens-deep',
    triggerCount: 'bg-pens-muted/40 text-pens-cream',
    saveLink: 'text-pens-cream/50 hover:text-pens-cream',
    input: 'bg-pens-deep border-pens-muted/40 text-pens-cream placeholder:text-pens-cream/30 focus:ring-1 focus:ring-pens-gold focus:border-pens-gold',
    cancel: 'text-pens-cream/50 hover:text-pens-cream',
    panel: 'bg-pens-surface border-pens-muted/40',
    empty: 'text-pens-cream/40',
    rowHover: 'hover:bg-pens-deep/60',
    rowName: 'text-pens-cream',
    rowMeta: 'text-pens-cream/40',
    deleteIcon: 'text-pens-cream/40 hover:text-pens-crimson',
    saveText: 'text-pens-cream',
  },
  light: {
    trigger: 'text-gray-500 hover:text-gray-700 border-gray-200 bg-white hover:bg-gray-50',
    triggerCount: 'bg-gray-100 text-gray-600',
    saveLink: 'text-gray-400 hover:text-gray-600',
    input: 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-gray-400 focus:border-gray-400',
    cancel: 'text-gray-400 hover:text-gray-600',
    panel: 'bg-white border-gray-200',
    empty: 'text-gray-400',
    rowHover: 'hover:bg-gray-50',
    rowName: 'text-gray-800',
    rowMeta: 'text-gray-400',
    deleteIcon: 'text-red-400 hover:text-red-600',
    saveText: 'text-white',
  },
} as const

export default function PresetPicker({
  module,
  onApply,
  currentValues,
  accentColor = 'bg-pens-muted',
  variant = 'dark',
}: Props) {
  const t = THEMES[variant]
  const [presets, setPresets] = useState<Preset[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/presets?module=${module}`)
    if (res.ok) setPresets(await res.json())
  }, [module])

  useEffect(() => { load() }, [load])

  const applyPreset = async (preset: Preset) => {
    try {
      const data = JSON.parse(preset.data)
      onApply(data)
      setOpen(false)
      // increment usage count (fire and forget)
      fetch('/api/presets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: preset.id }) })
      setPresets(p => p.map(x => x.id === preset.id ? { ...x, usedCount: x.usedCount + 1 } : x))
    } catch {
      // malformed JSON — ignore
    }
  }

  const deletePreset = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await fetch('/api/presets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setPresets(p => p.filter(x => x.id !== id))
  }

  const savePreset = async () => {
    if (!saveName.trim() || !currentValues) return
    setSaving(true)
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, name: saveName.trim(), data: currentValues }),
      })
      if (res.ok) {
        await load()
        setSaveName('')
        setShowSaveForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Preset dropdown trigger */}
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setShowSaveForm(false) }}
          className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-colors ${t.trigger}`}
        >
          <Bookmark size={12} />
          Presets
          {presets.length > 0 && (
            <span className={`rounded-full px-1.5 text-xs font-medium ${t.triggerCount}`}>{presets.length}</span>
          )}
          <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Save current as preset */}
        {currentValues && !showSaveForm && (
          <button
            type="button"
            onClick={() => { setShowSaveForm(true); setOpen(false) }}
            className={`flex items-center gap-1 text-xs transition-colors ${t.saveLink}`}
          >
            <Plus size={12} />
            Save as preset
          </button>
        )}
      </div>

      {/* Save form */}
      {showSaveForm && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="Preset name…"
            className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none ${t.input}`}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); savePreset() } if (e.key === 'Escape') setShowSaveForm(false) }}
            autoFocus
          />
          <button
            type="button"
            onClick={savePreset}
            disabled={!saveName.trim() || saving}
            className={`${accentColor} ${t.saveText} text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 transition-opacity`}
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setShowSaveForm(false)}
            className={`text-xs px-2 ${t.cancel}`}
          >
            ✕
          </button>
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <div className={`absolute z-20 top-full left-0 mt-1 w-64 border rounded-xl shadow-lg py-1 ${t.panel}`}>
          {presets.length === 0 ? (
            <p className={`px-3 py-3 text-xs text-center ${t.empty}`}>No presets yet — fill a form and save it as preset</p>
          ) : (
            presets.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left group transition-colors ${t.rowHover}`}
              >
                <div>
                  <p className={`text-sm font-medium ${t.rowName}`}>{preset.name}</p>
                  {preset.usedCount > 0 && (
                    <p className={`text-xs ${t.rowMeta}`}>Used {preset.usedCount}×</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={e => deletePreset(e, preset.id)}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${t.deleteIcon}`}
                >
                  <Trash2 size={13} />
                </button>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
